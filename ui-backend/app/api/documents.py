from fastapi import APIRouter
from app.services.mysql_aggregator import get_gold_staged_documents

router = APIRouter()

@router.get("")
def list_documents():
    return get_gold_staged_documents()
