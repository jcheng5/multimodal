# Video in, audio out

This is a [Shiny for Python](https://shiny.posit.co/py/) app for easily interacting with GPT-4o via short webcam recordings.

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

