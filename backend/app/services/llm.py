"""LM Studio (OpenAI uyumlu) istemcisi.

Host üzerinde çalışan LM Studio'ya konuşur. Belgeler ASLA dış bir API'ye
gönderilmez — tüm çıkarım lokaldir.
"""
import httpx

from app.config import get_settings


class LLMClient:
    def __init__(self) -> None:
        settings = get_settings()
        self.base_url = settings.llm_base_url.rstrip("/")
        self.api_key = settings.llm_api_key
        self.model = settings.llm_model
        self.timeout = settings.llm_request_timeout

    @property
    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.api_key}"}

    async def list_models(self) -> list[str]:
        """LM Studio'da yüklü modelleri döndürür (sağlık kontrolü için)."""
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{self.base_url}/models", headers=self._headers)
            resp.raise_for_status()
            data = resp.json()
            return [m["id"] for m in data.get("data", [])]

    async def chat(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.2,
        json_mode: bool = False,
    ) -> str:
        """Sohbet tamamlama. json_mode=True ise modelden JSON üretmesi istenir."""
        payload: dict = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                f"{self.base_url}/chat/completions",
                headers=self._headers,
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]


llm_client = LLMClient()
