"""Área pós-login — asserções fluentes para validar sessão autenticada."""

from __future__ import annotations

from selenium.webdriver.common.by import By

from pages.base_page import BasePage
from typing_extensions import Self


class PosLoginDashboardPage(BasePage):
    """Dashboard / home autenticado; refine locators quando mapear o pós-login."""

    _BODY = (By.TAG_NAME, "body")

    def aguardar_carregamento(self) -> Self:
        self.wait_document_ready().verificar_presenca_de_elemento(
            self._BODY,
            "Área autenticada deve exibir conteúdo",
        )
        return self

    def verificar_dashboard(self) -> Self:
        """Confirma que a área principal carregou após o login (passo final estilo IDE)."""
        return self.aguardar_carregamento()

    def check_se_logado(self) -> Self:
        """Encapsula assert de sessão; hoje valida o mesmo que verificar_dashboard — amplie com locators de menu/logout."""
        return self.verificar_dashboard()
