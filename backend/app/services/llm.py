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
        json_schema: dict | None = None,
        user: str | None = None,
    ) -> str:
        """Sohbet tamamlama.

        json_schema verilirse model yanıtı o JSON şemasına uymaya zorlanır
        (LM Studio "json_schema" response_format — Faz 3 yapısal çıktı için).
        """
        payload: dict = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
        }
        if user:
            # LiteLLM bunu "end_user" olarak kaydeder → kişi bazlı token/maliyet.
            payload["user"] = user
        if json_schema is not None:
            payload["response_format"] = {
                "type": "json_schema",
                "json_schema": {"name": "response", "strict": True, "schema": json_schema},
            }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                f"{self.base_url}/chat/completions",
                headers=self._headers,
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]

    async def chat_stream(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.3,
        user: str | None = None,
    ):
        """Yanıtı parça parça (token) akıtır. content delta'larını yield eder."""
        import json as _json

        payload: dict = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "stream": True,
        }
        if user:
            payload["user"] = user

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/chat/completions",
                headers=self._headers,
                json=payload,
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line or not line.startswith("data:"):
                        continue
                    data = line[len("data:"):].strip()
                    if data == "[DONE]":
                        break
                    try:
                        chunk = _json.loads(data)
                        delta = chunk["choices"][0].get("delta", {}).get("content")
                        if delta:
                            yield delta
                    except Exception:  # noqa: BLE001 — bozuk parçayı atla
                        continue


llm_client = LLMClient()
