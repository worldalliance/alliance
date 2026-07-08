## Upload process for action videos

Assuming we have some e.g. `mp4` video file, recommended steps are:

**1. Subtitle Generation**

_Note: If your video already has subtitles/captions, you can skip this step._
Right now i use `whisper v2` for this.

- Install: `pip3 install openai-whisper`
- Run: `whisper alliance_video.mp4 --model large-v2 --output_format srt --language en`

Move on to step 2 while this runs.

**2. Color grading**

_Note: This is optional_
Right now i do this in `Davinci Resolve`. The process looks like:

1. drag video into media pool
2. drag from media pool onto timeline
3. select "color" tab from the bottom row
4. Click the "white balance" pipette icon from the bottom right, then click on a white part of the video (i.e. a wall in the background).
5. Done. Go to "deliver" tab in the bottom right, and render it out with reasonable settings (doesn't really matter, we are going to compress again later)

**3.** `ffmpeg` **Processing**

3 goals here: downscale, add SRT subtitles, and convert to HLS for serving. If you do not need subtitles, continue to 3b.

a) For videos that do **not** previously have subtitles
Right now I run:

```
ffmpeg \
  -i alliance_video.mp4 \
  -i alliance_video.srt \
  -map 0:v:0 -map 0:a:0 -map 1:0 \
  -c:v libx264 -preset fast -crf 28 -maxrate 2M -bufsize 4M \
  -vf scale=-2:720 \
  -c:a aac -b:a 128k \
  -c:s webvtt \
  -metadata:s:s:0 language=eng \
  -f hls \
  -hls_time 6 \
  -hls_list_size 0 \
  -hls_flags independent_segments \
  -var_stream_map "v:0,a:0,s:0,sgroup:subtitle,sname:English" \
  -master_pl_name playlist.m3u8 \
  output.m3u8
```

b) For videos that **already have** subtitles:

Run:

```
ffmpeg \
  -i alliance_video.mp4 \
  -map 0:v:0 -map 0:a:0 \
  -c:v libx264 -preset fast -crf 28 -maxrate 2M -bufsize 4M \
  -vf scale=-2:720 \
  -c:a aac -b:a 128k \
  -f hls \
  -hls_time 6 \
  -hls_list_size 0 \
  -hls_flags independent_segments \
  -var_stream_map "v:0,a:0" \
  -master_pl_name playlist.m3u8 \
  -profile:v high \
  -pix_fmt yuv420p \
  output.m3u8
```

change any settings as desired, but importantly we hardcode playlist.m3u8 as the master playlist output name for playback in `VideoPlayer.tsx`, so don't change that.

**4. Upload**

Make a video block in a form and upload all the generated files into it (`.m3u8`, `.ts`, and `.vtt`)

---



### Todo items

- whisper v2 is from 2022, there must be something better by now?
- At some point we must make a more automated process for this, but doing it on the server is complex as video manipulation requires a decent amount of memory (more memory than our servers have).

