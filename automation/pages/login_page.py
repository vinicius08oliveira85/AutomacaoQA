"""
Tela de login — defina locators reais após mapear o DOM do ambiente.

Interface fluente: preencher_credenciais → clicar_entrar → PosLoginDashboardPage;
fazer_login é atalho que encadeia os dois passos.
"""

from __future__ import annotations

from selenium.webdriver.common.by import By

from pages.base_page import BasePage
from pages.pos_login_dashboard_page import PosLoginDashboardPage
from typing_extensions import Self


class LoginPage(BasePage):
    """Login; ajuste _CAMPO_USUARIO, _CAMPO_SENHA e _BOTAO_ENTRAR ao DOM real."""

    _CAMPO_USUARIO = (By.ID, "usuario")
    _CAMPO_SENHA = (By.ID, "senha")
    _BOTAO_ENTRAR = (By.CSS_SELECTOR, "button[type='submit']")

    def abrir(self) -> Self:
        self.open_path("/login").wait_document_ready()
        return self

    def verificar_formulario_login_visivel(self) -> Self:
        """Passo de verificação estilo IDE antes de digitar credenciais."""
        return (
            self.verificar_presenca_de_elemento(self._CAMPO_USUARIO, "Campo de usuário deve estar visível")
            .verificar_presenca_de_elemento(self._CAMPO_SENHA, "Campo de senha deve estar visível")
            .verificar_presenca_de_elemento(self._BOTAO_ENTRAR, "Botão entrar deve estar visível")
        )

    def preencher_credenciais(self, usuario: str, senha: str) -> Self:
        """Comandos 'type' do Selenium IDE, encadeáveis antes de clicar_entrar."""
        (
            self.preencher_campo(
                self._CAMPO_USUARIO,
                usuario,
                "Campo de usuário deve aceitar digitação",
            ).preencher_campo(
                self._CAMPO_SENHA,
                senha,
                "Campo de senha deve aceitar digitação",
            )
        )
        return self

    def clicar_entrar(self) -> PosLoginDashboardPage:
        """Comando 'click' + espera de carga; retorna a próxima tela (dashboard)."""
        self.click(self._BOTAO_ENTRAR, "Botão de entrar deve ser clicável").wait_document_ready()
        return PosLoginDashboardPage(self.driver, self.base_url, self.explicit_wait)

    def fazer_login(self, usuario: str, senha: str) -> PosLoginDashboardPage:
        """Atalho: preencher_credenciais → clicar_entrar."""
        return self.preencher_credenciais(usuario, senha).clicar_entrar()
