"""Classe base para Page Objects: locators, interações e asserções com interface fluente."""

from __future__ import annotations

from typing import Any, Callable, Tuple

from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.remote.webelement import WebElement
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from typing_extensions import Self

Locator = Tuple[str, str]

# Tempo máximo aguardando document.readyState === "complete" antes de seguir para o elemento visual
# (evita ficar preso se Socket.io/API falhar em loop e o documento nunca “completar” como em SPA).
_READYSTATE_COMPLETE_ESPERA_MAX_S = 5

# Ruído comum em hom (Socket.io 404, CSP, frames, bundle hashed) — SEVERE no console, UI ainda utilizável (estilo IDE).
_CONSOLE_SEVERE_IGNORADOS_PADRAO: Tuple[str, ...] = (
    "content security policy",
    "content-security-policy",
    "violates the following content security policy",
    "socket.io",
    "socket.io/?",
    "websocket connection to",
    "failed: websocket",
    "net::err_",
    " 404 ",
    " 404 (",
    "status of 404",
    "unsafe attempt to load url",
    "unsafe attempt to load frame",
    "chrome-error://",
    "frame-ancestors",
    "frame ancestor",
    "index-bclnwxwi.js",
)


class BasePage:
    """Encapsula o driver, URL base, esperas explícitas e verificações encadeáveis."""

    def __init__(self, driver: WebDriver, base_url: str, explicit_wait: int) -> None:
        self.driver = driver
        self.base_url = base_url.rstrip("/")
        self.explicit_wait = explicit_wait
        self._wait = WebDriverWait(driver, explicit_wait)

    @property
    def wait(self) -> WebDriverWait:
        return self._wait

    def open_path(self, path: str = "") -> Self:
        path = path if path.startswith("/") else f"/{path}" if path else ""
        self.driver.get(f"{self.base_url}{path}")
        return self

    def wait_visible(self, locator: Locator, mensagem_falha: str = "") -> WebElement:
        try:
            return self.wait.until(EC.visibility_of_element_located(locator))
        except TimeoutException as exc:
            msg = mensagem_falha or f"Elemento não ficou visível: {locator}"
            raise AssertionError(msg) from exc

    def wait_present(self, locator: Locator, mensagem_falha: str = "") -> WebElement:
        try:
            return self.wait.until(EC.presence_of_element_located(locator))
        except TimeoutException as exc:
            msg = mensagem_falha or f"Elemento não apareceu no DOM: {locator}"
            raise AssertionError(msg) from exc

    def wait_clickable(self, locator: Locator, mensagem_falha: str = "") -> WebElement:
        try:
            return self.wait.until(EC.element_to_be_clickable(locator))
        except TimeoutException as exc:
            msg = mensagem_falha or f"Elemento não ficou clicável: {locator}"
            raise AssertionError(msg) from exc

    def wait_url_contains(self, fragmento: str, mensagem_falha: str = "") -> Self:
        try:
            self.wait.until(EC.url_contains(fragmento))
        except TimeoutException as exc:
            msg = mensagem_falha or f"URL não contém {fragmento!r}: {self.driver.current_url!r}"
            raise AssertionError(msg) from exc
        return self

    def wait_document_ready(self, locator_principal: Locator | None = None) -> Self:
        """
        Espera resiliente (estilo Selenium IDE): não trava só porque Socket.io/API falhou em loop.
        Aguarda no máximo `_READYSTATE_COMPLETE_ESPERA_MAX_S` por `complete`; se não vier, segue para o
        elemento visual (body por padrão) ou `interactive|complete`.
        """
        loc = locator_principal or (By.TAG_NAME, "body")
        driver = self.driver
        espera_ready = min(_READYSTATE_COMPLETE_ESPERA_MAX_S, max(1, self.explicit_wait))
        try:
            WebDriverWait(driver, espera_ready).until(
                lambda d: d.execute_script("return document.readyState") == "complete"
            )
        except TimeoutException:
            pass
        try:
            self.wait.until(EC.presence_of_element_located(loc))
        except TimeoutException:
            try:
                self.wait.until(
                    lambda d: d.execute_script("return document.readyState") in ("interactive", "complete")
                )
            except TimeoutException as exc:
                raise AssertionError(
                    "Página não ficou utilizável: nem o elemento principal apareceu nem o documento atingiu "
                    "interactive/complete (API/socket podem falhar, mas a UI principal deve surgir)."
                ) from exc
        return self

    def click(self, locator: Locator, mensagem_falha: str = "") -> Self:
        elemento = self.wait_clickable(locator, mensagem_falha)
        elemento.click()
        return self

    def preencher_campo(self, locator: Locator, texto: str, mensagem_falha: str = "") -> Self:
        elemento = self.wait_visible(locator, mensagem_falha)
        elemento.clear()
        elemento.send_keys(texto)
        return self

    def aguardar_condicao(self, condicao: Callable[[WebDriver], Any], mensagem: str = "") -> Any:
        try:
            return self.wait.until(condicao)
        except TimeoutException as exc:
            raise AssertionError(mensagem or "Condição personalizada não satisfeita no tempo limite") from exc

    def verificar_presenca_de_elemento(self, locator: Locator, mensagem: str = "") -> Self:
        """Encapsula a verificação de elemento visível (equivalente a assert + wait do IDE)."""
        texto = mensagem or f"Esperava elemento visível na página: {locator}"
        elemento = self.wait_visible(locator, texto)
        assert elemento.is_displayed(), texto
        return self

    def verificar_texto_no_elemento(
        self,
        locator: Locator,
        trecho_esperado: str,
        mensagem: str = "",
    ) -> Self:
        elemento = self.wait_visible(locator, mensagem or "Elemento para checagem de texto deve estar visível")
        obtido = (elemento.text or "").strip()
        assert trecho_esperado in obtido, (
            mensagem
            or f"Texto do elemento deveria conter {trecho_esperado!r}, obtido {obtido!r}"
        )
        return self

    def _mensagem_severe_relevante(self, mensagem: str, ignorar_contendo: Tuple[str, ...]) -> bool:
        """True se o SEVERE deve falhar o teste (não bate em nenhum padrão ignorado)."""
        m = (mensagem or "").lower()
        return not any(p.lower() in m for p in ignorar_contendo)

    def verificar_sem_erros_no_console(
        self,
        ignorar_mensagem_contendo: Tuple[str, ...] | None = None,
        aplicar_ignorados_padrao: bool = True,
    ) -> Self:
        """
        Lê `get_log('browser')` e falha se houver entradas SEVERE relevantes (404 de API, CSP, exceções JS, etc.).

        Padrões em `_CONSOLE_SEVERE_IGNORADOS_PADRAO` reduzem falso positivo quando a UI já carregou mas o
        ambiente ainda registra CSP/Socket.io, frames inseguros, `chrome-error://` ou bundles (ex.: index-*.js),
        alinhado ao `wait_document_ready` resiliente. Chame após cada navegação de rota para validar só o delta
        de logs desde a última leitura (comportamento típico do ChromeDriver).
        """
        try:
            logs = self.driver.get_log("browser")
        except Exception:
            # Firefox / drivers sem suporte a log de console via CDP
            return self

        ign = (
            (*_CONSOLE_SEVERE_IGNORADOS_PADRAO, *(ignorar_mensagem_contendo or ()))
            if aplicar_ignorados_padrao
            else tuple(ignorar_mensagem_contendo or ())
        )

        severos = [
            log
            for log in logs
            if str(log.get("level", "")).upper() == "SEVERE"
            and self._mensagem_severe_relevante(str(log.get("message", "")), ign)
        ]

        if severos:
            linhas = "\n".join(f"  [{log.get('level')}] {log.get('message', '')}" for log in severos)
            assert False, (
                "Console do navegador reportou erro(s) SEVERE não filtrado(s):\n"
                f"{linhas}\n"
                "Ajuste `ignorar_mensagem_contendo` ou os padrões padrão se o ruído for aceitável no hom."
            )
        return self
