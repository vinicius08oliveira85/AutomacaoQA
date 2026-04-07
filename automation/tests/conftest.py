"""Fixtures Pytest: driver, configurações e Page Objects prontos para interface fluente."""

from __future__ import annotations

import pytest

from config.settings_loader import Settings, load_settings
from pages.leve_saude_home_page import LeveSaudeHomePage
from pages.login_page import LoginPage
from utils.webdriver_factory import create_webdriver


@pytest.fixture(scope="session")
def settings() -> Settings:
    return load_settings()


@pytest.fixture
def driver(settings: Settings):
    drv = create_webdriver(settings)
    try:
        yield drv
    finally:
        drv.quit()


@pytest.fixture
def home_page(driver, settings: Settings) -> LeveSaudeHomePage:
    """Home já vinculada ao driver da sessão de teste (sem .open() automático — encadeie no teste)."""
    return LeveSaudeHomePage(driver, settings.base_url, settings.explicit_wait)


@pytest.fixture
def login_page(driver, settings: Settings) -> LoginPage:
    """Login vinculado ao driver; use .abrir() ou chegue via home_page.ir_para_login()."""
    return LoginPage(driver, settings.base_url, settings.explicit_wait)
