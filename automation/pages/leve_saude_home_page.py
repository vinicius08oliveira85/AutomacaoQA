"""Página inicial da aplicação Leve Saúde (hom). Ajuste locators quando mapear o DOM real."""

from __future__ import annotations

from selenium.webdriver.common.by import By

from pages.base_page import BasePage
from pages.login_page import LoginPage
from typing_extensions import Self


class LeveSaudeHomePage(BasePage):
    """Representa a landing page na raiz do `base_url`."""

    _BODY = (By.TAG_NAME, "body")

    def open(self) -> Self:
        (
            self.open_path("/")
            .wait_document_ready()
            .verificar_presenca_de_elemento(
                self._BODY,
                "A página inicial deve exibir o corpo (body) após o carregamento",
            )
        )
        return self

    def ir_para_login(self) -> LoginPage:
        """Navega para a rota de login e devolve o Page Object correspondente (fluxo IDE: open + go)."""
        self.open_path("/login").wait_document_ready()
        return LoginPage(self.driver, self.base_url, self.explicit_wait)

    def verificar_esta_na_origem_da_aplicacao(self) -> Self:
        """Asserção fluente: URL sob a base configurada."""
        atual = self.driver.current_url.rstrip("/")
        esperado = self.base_url.rstrip("/")
        assert atual.startswith(esperado), (
            f"Esperava URL sob a base da aplicação ({esperado!r}), obtido {atual!r}"
        )
        return self
