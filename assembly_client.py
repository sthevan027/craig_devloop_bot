import requests
import os
from dotenv import load_dotenv
import logging

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')

def transcribe_audio(audio_path):
    api_key = os.getenv("ASSEMBLYAI_API_KEY")
    if not api_key:
        logging.error("ASSEMBLYAI_API_KEY não definida no .env!")
        return None
    headers = {"authorization": api_key, "content-type": "application/octet-stream"}
    logging.info(f"Enviando {audio_path} para AssemblyAI...")
    with open(audio_path, "rb") as f:
        response = requests.post(
            "https://api.assemblyai.com/v2/upload",
            headers=headers,
            data=f
        )
    logging.info(f"Upload feito, resposta: {response.status_code}")
    if response.status_code != 200:
        logging.error(f"Falha no upload: {response.text}")
        return None
    audio_url = response.json()["upload_url"]

    transcript_request = {
        "audio_url": audio_url,
        "language_code": "pt"
    }

    transcribe = requests.post("https://api.assemblyai.com/v2/transcript", headers={"authorization": api_key}, json=transcript_request)
    logging.info(f"Transcript requisitado, resposta: {transcribe.status_code}")
    if transcribe.status_code != 200:
        logging.error(f"Falha ao requisitar transcrição: {transcribe.text}")
        return None
    transcript_id = transcribe.json()["id"]

    while True:
        polling = requests.get(f"https://api.assemblyai.com/v2/transcript/{transcript_id}", headers={"authorization": api_key}).json()
        logging.info(f"Status do transcript: {polling['status']}")
        if polling["status"] == "completed":
            return {
                "title": "Reunião DevLoop",
                "summary": None,
                "transcript": polling["text"],
                "audioUrl": audio_url
            }
        elif polling["status"] == "failed":
            logging.error(f"Transcrição falhou: {polling}")
            return None
