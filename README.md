# Video in, audio out

This is a Python app written in [Shiny](https://shiny.posit.co/py/), for easily interacting with GPT-4o via short webcam recordings. It was created for a [livestream](https://www.youtube.com/watch?v=OLTgI6DAQ_A) with [@TinaHuang1](https://www.youtube.com/@TinaHuang1) and [Posit](https://posit.co).

At the time of this writing (late May 2024), GPT-4o is available via OpenAI's chat completion API, but this only takes text and images as input and returns text as output. This app uses speech-to-text and text-to-speech to bridge the gap, allowing you to speak your prompt and provide a webcam feed, and hear the response.

**Live demo:** [https://jcheng.shinyapps.io/multimodal/](https://jcheng.shinyapps.io/multimodal/)  
**R version:** [https://github.com/jcheng5/r-multimodal](https://github.com/jcheng5/r-multimodal)

## Installation

### ffmpeg

You will need the `ffmpeg` utility installed. Either use the [official installers](https://ffmpeg.org/download.html), or `brew install ffmpeg` (for macOS brew users) or `choco install ffmpeg` (for Windows chocolatey users).

### OpenAI API key

Create a file called `.env` in the root of the project and add the following line:

```
OPENAI_API_KEY=<your-api-key>
```

If you have an OpenAI account, you can generate an API key from [this page](https://platform.openai.com/api-keys).

### Python dependencies

```
pip install -r requirements.txt
```

## Usage

```
shiny run app.py --port 0 --launch-browser
```

This will launch a browser window with a video preview. Press Record, speak your prompt, and press Stop. The video will be processed and the response will be read aloud.

