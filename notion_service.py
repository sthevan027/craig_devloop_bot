import os
from notion_client import Client
from datetime import datetime
from transformers import pipeline
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')

notion_api_key = os.getenv("NOTION_API_KEY")
database_id = os.getenv("NOTION_DATABASE_ID")
if not notion_api_key or not database_id:
    logging.error("NOTION_API_KEY ou NOTION_DATABASE_ID não definidos no .env!")
notion = Client(auth=notion_api_key) if notion_api_key else None

# Carrega o pipeline de sumarização (modelo mT5 multilingue, suporta português)
summarizer = pipeline("summarization", model="csebuetnlp/mT5_multilingual_XLSum")

def get_username(user_id, username=None):
    if username:
        return username
    return f"Usuário {user_id}"

def resumir_em_portugues(transcricao):
    def get_max_length(texto):
        return max(30, min(120, len(texto) // 2))
    if len(transcricao) > 2000:
        partes = [transcricao[i:i+2000] for i in range(0, len(transcricao), 2000)]
        resumos = [summarizer(parte, max_length=get_max_length(parte), min_length=30, do_sample=False)[0]['summary_text'] for parte in partes]
        return '\n'.join(resumos)
    else:
        return summarizer(transcricao, max_length=get_max_length(transcricao), min_length=30, do_sample=False)[0]['summary_text']

def save_to_notion(data):
    if not notion or not database_id:
        logging.error("Notion não configurado corretamente!")
        return
    logging.info(f"Salvando no Notion: {data}")
    agora = datetime.now().strftime("%d/%m/%Y %H:%M")
    user_id = data.get("user_id", "?")
    username = get_username(user_id, data.get("username"))
    titulo = f"Reunião DevLoop - {agora} - {username}"
    resumo = resumir_em_portugues(data["transcript"])
    transcript_blocks = [
        data["transcript"][i:i+2000] for i in range(0, len(data["transcript"]), 2000)
    ]
    children = [
        {
            "object": "block",
            "type": "paragraph",
            "paragraph": {
                "rich_text": [{"text": {"content": f"Resumo técnico de {username}: " + resumo}}]
            }
        }
    ]
    for bloco in transcript_blocks:
        children.append({
            "object": "block",
            "type": "paragraph",
            "paragraph": {
                "rich_text": [{"text": {"content": f"{username}: {bloco}"}}]
            }
        })
    try:
        notion.pages.create(
            parent={ "database_id": database_id },
            properties={
                "Nome": {
                    "title": [{"text": {"content": titulo}}]
                },
                "Data da Reunião": {
                    "date": {"start": datetime.now().strftime("%Y-%m-%dT%H:%M:%S")}
                },
            },
            children=children
        )
        logging.info("Salvo no Notion com sucesso!")
    except Exception as e:
        logging.error(f"Erro ao salvar no Notion: {e}")
