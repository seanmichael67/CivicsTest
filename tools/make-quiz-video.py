#!/usr/bin/env python3
"""Assemble one finished quiz video (1080x1920, vertical) from three inputs:

  1. the tutor clip      -- she asks the question on camera (the expensive part)
  2. the narration take  -- the whole voice-over as one audio file
  3. videos/scripts.json -- the words for the cards

Timeline:  tutor asks  ->  "Say your answer out loud"  ->  3-2-1 countdown
           ->  answer card  ->  end card

Two steps, because the tutor clip has to lip-sync to the first part of the audio:

  python3 tools/make-quiz-video.py cut      --number 2 --narration take.mp3
      writes q002_question.mp3 (give this to the video model) and prints how
      many seconds the tutor clip must be.

  python3 tools/make-quiz-video.py assemble --number 2 --narration take.mp3 \
      --tutor tutor.mp4 --out q002.mp4

Needs ffmpeg, Pillow and faster-whisper (all preinstalled in the Higgsfield sandbox).
"""
import argparse, json, math, os, re, shutil, subprocess, sys, tempfile

W, H, FPS = 1080, 1920, 30
NAVY, BLUE, GOLD, SOFT, WHITE, MUTED = '#0f172a', '#1d4ed8', '#f59e0b', '#eff6ff', '#ffffff', '#cbd5e1'
# First words of the three fixed sentences in the narration. Everything before
# "say your" is the tutor on camera; each anchor starts the next section.
ANCHORS = {'pause': ['say', 'your', 'answer'], 'end': ['practice', 'more', 'questions']}
ANSWER_STARTS = (['the', 'answer'], ['one', 'accepted'], ['you', 'could'], ['this', 'answer'])
COUNTDOWN = 3


def run(*cmd):
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def duration(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path],
                         check=True, capture_output=True, text=True).stdout
    return float(out.strip())


def words_of(narration):
    from faster_whisper import WhisperModel
    model = WhisperModel('base.en', compute_type='int8')
    segs, _ = model.transcribe(narration, word_timestamps=True)
    return [(re.sub(r'[^a-z0-9]', '', w.word.lower()), w.start, w.end) for s in segs for w in s.words]


def find(words, phrase, start=0):
    for i in range(start, len(words) - len(phrase) + 1):
        if [w[0] for w in words[i:i + len(phrase)]] == phrase:
            return i
    return -1


def cut_points(narration):
    """Where each section of the one-take narration begins and ends, in seconds."""
    words = words_of(narration)
    heard = ' '.join(w[0] for w in words)
    i_pause = find(words, ANCHORS['pause'])
    if i_pause < 1:
        sys.exit(f'Could not hear "Say your answer out loud" in the narration. Heard: {heard}')
    i_answer = min((i for i in (find(words, a, i_pause + 3) for a in ANSWER_STARTS) if i > 0), default=-1)
    i_end = find(words, ANCHORS['end'], max(i_answer, i_pause))
    if i_answer < 0 or i_end < 0:
        sys.exit(f'Could not find the answer or the closing line in the narration. Heard: {heard}')
    mid = lambda i: (words[i - 1][2] + words[i][1]) / 2  # middle of the silence before word i
    return {
        'question_end': words[i_pause - 1][2], 'pause_start': words[i_pause][1],
        # Never past answer_start: with a short breath before the answer, the
        # prompt card would otherwise play the answer's first sound, and the
        # answer card would then play it again after the countdown.
        'pause_end': min(words[i_answer - 1][2] + 0.35, mid(i_answer)),
        'answer_start': mid(i_answer), 'answer_end': mid(i_end),
        'end_start': mid(i_end), 'end_end': words[-1][2] + 0.8,
        'heard': heard,
    }


# ---------- drawing ----------
def font(size, bold=True):
    from PIL import ImageFont
    want = 'Montserrat-ExtraBold' if bold else 'Montserrat-Medium'
    fonts = subprocess.run(['fc-list', '--format', '%{file}\n'], capture_output=True, text=True).stdout.split('\n')
    for f in fonts:
        if want in f:
            return ImageFont.truetype(f, size)
    for f in fonts:  # any bold-ish sans rather than failing
        if re.search(r'(Montserrat|Metropolis|DejaVuSans).*Bold', f):
            return ImageFont.truetype(f, size)
    sys.exit('No usable font found (expected Montserrat).')


def wrap(draw, text, fnt, max_w):
    lines, line = [], ''
    for word in text.split():
        trial = (line + ' ' + word).strip()
        if draw.textlength(trial, font=fnt) <= max_w or not line:
            line = trial
        else:
            lines.append(line)
            line = word
    return lines + [line]


def fit(draw, text, max_w, max_lines, sizes, bold=True):
    """Largest font from `sizes` at which the text fits in max_lines."""
    for size in sizes:
        fnt = font(size, bold)
        lines = wrap(draw, text, fnt, max_w)
        if len(lines) <= max_lines:
            return fnt, lines
    return fnt, lines


def block(draw, lines, fnt, y, fill, gap=1.22, x=None, max_w=None):
    """Draw centred lines starting at y; return the y below them."""
    step = int(fnt.size * gap)
    for ln in lines:
        w = draw.textlength(ln, font=fnt)
        draw.text(((W - w) / 2 if x is None else x + (max_w - w) / 2, y), ln, font=fnt, fill=fill)
        y += step
    return y


def pill(draw, text, y, fill=BLUE, color=WHITE, size=40):
    fnt = font(size)
    w = draw.textlength(text, font=fnt) + 64
    draw.rounded_rectangle(((W - w) / 2, y, (W + w) / 2, y + size + 40), radius=(size + 40) // 2, fill=fill)
    draw.text(((W - w) / 2 + 32, y + 17), text, font=fnt, fill=color)
    return y + size + 40


def background():
    from PIL import Image
    img = Image.new('RGB', (W, H), NAVY)
    px = img.load()
    for y in range(H):  # navy at the top fading to brand blue
        t = y / H
        row = (int(15 + (29 - 15) * t), int(23 + (78 - 23) * t), int(42 + (216 - 42) * t * 0.75))
        for x in range(W):
            px[x, y] = row
    return img


FOOT = 'AI tutor  ·  Independent study aid, not affiliated with USCIS'


def footer(draw):
    fnt = font(26, bold=False)
    block(draw, [FOOT], fnt, H - 330, MUTED)


def tutor_overlay(s, path):
    """Transparent layer over the tutor clip: question number on top, question below."""
    from PIL import Image, ImageDraw
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pill(d, f'Question {s["number"]} of 128', 150)
    fnt, lines = fit(d, s['say_question'], W - 200, 4, (58, 52, 46, 40, 36))
    h = int(len(lines) * fnt.size * 1.22) + 56
    top = H - 420 - h
    d.rounded_rectangle((70, top, W - 70, top + h), radius=36, fill=(15, 23, 42, 215))
    block(d, lines, fnt, top + 28, WHITE)
    img.save(path)


def pause_card(frame, s, path, count=None):
    """Tutor's last frame, blurred and dimmed, with the prompt (and countdown number)."""
    from PIL import Image, ImageDraw, ImageFilter, ImageEnhance
    img = Image.open(frame).convert('RGB').resize((W, H))
    img = ImageEnhance.Brightness(img.filter(ImageFilter.GaussianBlur(14))).enhance(0.45)
    d = ImageDraw.Draw(img)
    pill(d, f'Question {s["number"]} of 128', 150)
    fnt, lines = fit(d, s['say_question'], W - 200, 4, (50, 44, 40, 36), bold=False)
    y = block(d, lines, fnt, 300, MUTED)
    fnt2 = font(84)
    y = block(d, ['Say your answer', 'out loud'], fnt2, 660, WHITE)
    if count is not None:
        r = 170
        cy = y + 110 + r
        d.ellipse((W / 2 - r, cy - r, W / 2 + r, cy + r), outline=GOLD, width=16)
        f3 = font(210)
        tw = d.textlength(str(count), font=f3)
        d.text(((W - tw) / 2, cy - 135), str(count), font=f3, fill=GOLD)
    img.save(path)


def answer_card(s, path):
    from PIL import Image, ImageDraw
    img = background()
    d = ImageDraw.Draw(img)
    pill(d, f'Question {s["number"]} of 128', 150)
    # The question and answers are drawn on their own layer first, then placed
    # in the middle of the free space, so one short answer does not leave the
    # card top-heavy and five long ones still fit.
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d2 = ImageDraw.Draw(layer)
    fnt, lines = fit(d2, s['say_question'], W - 180, 5, (52, 46, 42, 38, 34), bold=False)
    y = block(d2, lines, fnt, 0, WHITE) + 60
    label = 'CHECK YOUR OWN ANSWER' if s['needs_lookup'] else ('ACCEPTED ANSWERS' if len(s['on_screen_answers']) > 1 else 'ANSWER')
    y = block(d2, [label], font(44), y, GOLD) + 26
    answers = s['on_screen_answers'][:5]
    size_opts = (72, 62, 54, 46, 40) if len(answers) <= 2 else (54, 48, 42, 38, 34)
    for a in answers:
        fnt, lines = fit(d2, a, W - 260, 3, size_opts)
        h = int(len(lines) * fnt.size * 1.22) + 60
        d2.rounded_rectangle((90, y, W - 90, y + h), radius=34, fill=SOFT)
        block(d2, lines, fnt, y + 30, NAVY)
        y += h + 22
    if s.get('more_answers_accepted'):
        y = block(d2, ['More answers are accepted.', 'See them all at the link.'], font(36, bold=False), y + 14, MUTED)
    top, bottom = 290, H - 380  # below the pill, above the footer and the Shorts buttons
    offset = top + max(0, (bottom - top - y) // 2)
    img.paste(layer, (0, offset), layer)
    footer(d)
    img.save(path)


def end_card(path):
    from PIL import ImageDraw
    img = background()
    d = ImageDraw.Draw(img)
    y = block(d, ['The real test', 'is spoken.'], font(104), 420, WHITE) + 40
    y = block(d, ['Practice all 128 questions', 'out loud. It speaks.', 'It listens. It is free.'], font(54, bold=False), y, WHITE) + 70
    fnt = font(60)
    w = d.textlength('uscis128civicstest.com', font=fnt) + 90
    d.rounded_rectangle(((W - w) / 2, y, (W + w) / 2, y + 150), radius=75, fill=GOLD)
    d.text(((W - w) / 2 + 45, y + 40), 'uscis128civicstest.com', font=fnt, fill=NAVY)
    block(d, ['Link in the description'], font(40, bold=False), y + 190, MUTED)
    footer(d)
    img.save(path)


# ---------- video ----------
VENC = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', str(FPS)]
AENC = ['-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-ac', '2']


def still(img, audio, a_from, a_to, out, extra_silence=0.0):
    """A still image shown for (a_to - a_from) seconds of narration, plus silence."""
    dur = (a_to - a_from) + extra_silence
    if a_to > a_from:
        a_in = ['-ss', f'{a_from:.3f}', '-t', f'{a_to - a_from:.3f}', '-i', audio]
        af = f'apad=whole_dur={dur:.3f}'
    else:
        a_in = ['-f', 'lavfi', '-t', f'{dur:.3f}', '-i', 'anullsrc=r=44100:cl=stereo']
        af = 'anull'
    run('ffmpeg', '-y', '-loop', '1', '-t', f'{dur:.3f}', '-i', img, *a_in, '-af', af,
        '-t', f'{dur:.3f}', *VENC, *AENC, out)


def cmd_cut(a):
    s = script(a.number)
    cp = cut_points(a.narration)
    # The tutor stays on screen until just before "Say your answer", so her clip
    # is the question plus a held smile. Video models take whole seconds.
    secs = math.ceil(cp['question_end'] + 0.3)
    if secs > cp['pause_start']:
        secs = math.floor(cp['pause_start'])
    if secs < cp['question_end']:
        # No whole second falls in the silence after the question, so any clip
        # length would either cut her off or run into the next sentence.
        sys.exit(f'The pause after the question is too short to cut on a whole second (question ends at '
                 f'{cp["question_end"]:.2f}s, "Say your answer" starts at {cp["pause_start"]:.2f}s). '
                 f'Record the narration again; it usually comes out with a longer pause.')
    out = a.out or f'q{a.number:03d}_question.mp3'
    run('ffmpeg', '-y', '-i', a.narration, '-t', f'{secs}', '-af', f'afade=t=out:st={secs - 0.15}:d=0.15',
        '-ar', '24000', '-b:a', '128k', out)
    print(json.dumps({'question_audio': out, 'tutor_clip_seconds': secs, 'heard': cp['heard'],
                      'expected': s['narration']}, indent=2))


def cmd_assemble(a):
    s = script(a.number)
    cp = cut_points(a.narration)
    t_tutor = duration(a.tutor)
    if not (cp['question_end'] <= t_tutor <= cp['pause_start'] + 0.05):
        sys.exit(f'The tutor clip is {t_tutor:.2f}s but the question ends at {cp["question_end"]:.2f}s and '
                 f'"Say your answer" starts at {cp["pause_start"]:.2f}s. Re-run "cut" and regenerate the clip.')
    with tempfile.TemporaryDirectory() as tmp:
        f = lambda n: os.path.join(tmp, n)
        tutor_overlay(s, f('ov.png'))
        # A: the tutor, with the narration laid back over her so every video has
        # identical audio quality whatever the video model did to its soundtrack.
        run('ffmpeg', '-y', '-i', a.tutor, '-i', f('ov.png'), '-t', f'{t_tutor:.3f}', '-i', a.narration,
            '-filter_complex', f'[0:v]scale={W}:{H}:flags=lanczos,setsar=1[v];[v][1:v]overlay=0:0[o]',
            '-map', '[o]', '-map', '2:a', '-t', f'{t_tutor:.3f}', *VENC, *AENC, f('a.mp4'))
        run('ffmpeg', '-y', '-sseof', '-0.2', '-i', a.tutor, '-frames:v', '1', '-update', '1', f('last.png'))
        parts = [f('a.mp4')]
        pause_card(f('last.png'), s, f('p.png'))
        still(f('p.png'), a.narration, t_tutor, cp['pause_end'], f('b.mp4'))
        parts.append(f('b.mp4'))
        for n in range(COUNTDOWN, 0, -1):
            pause_card(f('last.png'), s, f(f'c{n}.png'), count=n)
            still(f(f'c{n}.png'), a.narration, 0, 0, f(f'c{n}.mp4'), extra_silence=1.0)
            parts.append(f(f'c{n}.mp4'))
        answer_card(s, f('ans.png'))
        still(f('ans.png'), a.narration, cp['answer_start'], cp['answer_end'], f('d.mp4'), extra_silence=0.6)
        parts.append(f('d.mp4'))
        end_card(f('end.png'))
        still(f('end.png'), a.narration, cp['end_start'], cp['end_end'], f('e.mp4'))
        parts.append(f('e.mp4'))
        with open(f('list.txt'), 'w') as fh:
            fh.writelines(f"file '{p}'\n" for p in parts)
        run('ffmpeg', '-y', '-f', 'concat', '-safe', '0', '-i', f('list.txt'), *VENC, *AENC,
            '-movflags', '+faststart', a.out)
        if a.keep_cards:
            os.makedirs(a.keep_cards, exist_ok=True)
            for n in ('ov.png', 'p.png', 'c3.png', 'ans.png', 'end.png'):
                shutil.copyfile(f(n), os.path.join(a.keep_cards, n))  # tmp may be another disk
    print(json.dumps({'out': a.out, 'seconds': round(duration(a.out), 2), 'heard': cp['heard']}, indent=2))


def script(number):
    here = os.path.dirname(os.path.abspath(__file__))
    path = os.environ.get('QUIZ_SCRIPTS') or os.path.join(here, '..', 'videos', 'scripts.json')
    with open(path, encoding='utf-8') as fh:
        for s in json.load(fh):
            if s['number'] == number:
                return s
    sys.exit(f'No question {number} in {path}')


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)
    c = sub.add_parser('cut')
    c.add_argument('--number', type=int, required=True)
    c.add_argument('--narration', required=True)
    c.add_argument('--out')
    c.set_defaults(fn=cmd_cut)
    m = sub.add_parser('assemble')
    m.add_argument('--number', type=int, required=True)
    m.add_argument('--narration', required=True)
    m.add_argument('--tutor', required=True)
    m.add_argument('--out', required=True)
    m.add_argument('--keep-cards', help='folder to save the card images in, for checking')
    m.set_defaults(fn=cmd_assemble)
    args = ap.parse_args()
    args.fn(args)
