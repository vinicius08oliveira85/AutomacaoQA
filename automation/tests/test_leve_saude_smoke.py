"""Testes estilo Selenium IDE: só encadeamento de métodos nas Page Objects."""

from __future__ import annotations

import os

import pytest

from tests.base_test import BaseTest

_REQUER_CREDENCIAIS = pytest.mark.skipif(
    not os.environ.get("AUTOMATION_USER") or not os.environ.get("AUTOMATION_PASSWORD"),
    reason="Defina AUTOMATION_USER e AUTOMATION_PASSWORD para E2E de login.",
)


class TestLeveSaudeSmoke(BaseTest):
    def test_home_carrega_e_valida_origem(self, home_page):
        (
            home_page.open()
            .verificar_sem_erros_no_console()
            .verificar_esta_na_origem_da_aplicacao()
        )

    @_REQUER_CREDENCIAIS
    def test_fluxo_ide_home_login_dashboard(self, home_page):
        u = os.environ["AUTOMATION_USER"]
        s = os.environ["AUTOMATION_PASSWORD"]
        (
            home_page.open()
            .verificar_sem_erros_no_console()
            .ir_para_login()
            .verificar_sem_erros_no_console()
            .preencher_credenciais(u, s)
            .clicar_entrar()
            .verificar_dashboard()
        )

    @_REQUER_CREDENCIAIS
    def test_fluxo_com_fazer_login_e_check_se_logado(self, home_page):
        u = os.environ["AUTOMATION_USER"]
        s = os.environ["AUTOMATION_PASSWORD"]
        (
            home_page.open()
            .verificar_sem_erros_no_console()
            .ir_para_login()
            .verificar_sem_erros_no_console()
            .fazer_login(u, s)
            .check_se_logado()
        )

    def test_login_page_fixture_encadeado(self, login_page):
        """Exemplo usando fixture login_page diretamente (sem passar pela home)."""
        (
            login_page.abrir()
            .verificar_sem_erros_no_console()
            .verificar_formulario_login_visivel()
        )
