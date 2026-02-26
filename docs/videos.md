## Upload process for action videos

Assuming we have some e.g. `mp4` video file, recommended steps are:

**1. Subtitle Generation**

Right now i use `whisper v2` for this.

- Install: `pip3 install openai-whisper`

- Run: `whisper alliance_video.mov --model large-v2 --output_format srt --language en`

Move on to step 2 while this runs.

**2. Color grading**

Right now i do this in `Davinci Resolve`. The process looks like:

1. drag video into media pool

2. drag from media pool onto timeline

3. select "color" tab from the bottom row

4. Click the "white balance" pipette icon from the bottom right, then click on a white part of the video (i.e. a wall in the background).

5. Done. Go to "deliver" tab in the bottom right, and render it out with reasonable settings (doesn't really matter, we are going to compress again later)

**3. `ffmpeg` Processing**

3 goals here: downscale, add SRT subtitles, and convert to HLS for serving.

Right now I run:

```
ffmpeg \
  -i alliance_graded.mov \
  -i alliance_graded.srt \
  -map 0:v:0 -map 0:a:0 -map 1:0 \
  -c:v libx264 -preset fast -crf 28 -maxrate 2M -bufsize 4M \
  -vf scale=-2:720 \
  -c:a aac -b:a 128k \
  -c:s webvtt \
  -f hls \
  -hls_time 6 \
  -hls_list_size 0 \
  -hls_flags independent_segments \
  -var_stream_map "v:0,a:0,s:0,sgroup:subtitle" \
  -master_pl_name playlist.m3u8 \
  output.m3u8
```

change any settings as desired, but importantly we hardcode playlist.m3u8 as the master playlist output name for playback in `VideoPlayer.tsx`, so don't change that.

**4. Upload**

Make a video block in a form and upload all the generated files into it (`.m3u8`, `.ts`, and `.vtt`)

---

### Todo items

- Set subtitle track name with ffmpeg

- whisper v2 is from 2022, there must be something better by now?

- At some point we must make a more automated process for this, but doing it on the server is complex as video manipulation requires a decent amount of memory (more memory than our servers have).
