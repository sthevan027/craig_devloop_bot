import sys
import logging
from assembly_client import transcribe_audio
from notion_service import save_to_notion

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')

if __name__ == "__main__":
    if len(sys.argv) < 4:
        logging.error("Uso: python process_audio.py <caminho_do_arquivo_wav> <user_id> <username>")
        sys.exit(1)
    audio_path = sys.argv[1]
    user_id = sys.argv[2]
    username = sys.argv[3]
    logging.info(f"Processando arquivo: {audio_path} para user {user_id} ({username})")
    try:
        resultado = transcribe_audio(audio_path)
        if resultado:
            resultado['user_id'] = user_id
            resultado['username'] = username
            save_to_notion(resultado)
            logging.info("✅ Resumo salvo no Notion!")
        else:
            logging.error("[ERROR] Falha na transcrição, nada enviado ao Notion!")
    except Exception as e:
        logging.error(f"Erro inesperado: {e}")
