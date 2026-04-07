"""Fábrica de WebDriver alinhada às configurações (sem espera implícita — use BasePage / waits explícitos)."""

from __future__ import annotations

from selenium import webdriver
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.edge.options import Options as EdgeOptions
from selenium.webdriver.firefox.options import Options as FirefoxOptions

from config.settings_loader import Settings

# Chromium (Chrome/Edge): habilita coleta de console e performance para `get_log("browser")` / análises.
_GOOG_LOGGING_PREFS = {"browser": "ALL", "performance": "ALL"}


def _headless_chrome_options(opts: ChromeOptions, settings: Settings) -> None:
    if settings.headless:
        opts.add_argument("--headless=new")
        opts.add_argument("--disable-gpu")
        opts.add_argument("--window-size=1920,1080")


def _headless_edge_options(opts: EdgeOptions, settings: Settings) -> None:
    if settings.headless:
        opts.add_argument("--headless=new")
        opts.add_argument("--disable-gpu")
        opts.add_argument("--window-size=1920,1080")


def _headless_firefox_options(opts: FirefoxOptions, settings: Settings) -> None:
    if settings.headless:
        opts.add_argument("-headless")


def _aplicar_logging_chromium(opts: ChromeOptions | EdgeOptions) -> None:
    opts.set_capability("goog:loggingPrefs", _GOOG_LOGGING_PREFS)


def create_webdriver(settings: Settings):
    name = settings.browser_name

    if name == "edge":
        opts = EdgeOptions()
        _headless_edge_options(opts, settings)
        _aplicar_logging_chromium(opts)
        driver = webdriver.Edge(options=opts)
    elif name == "chrome":
        opts = ChromeOptions()
        _headless_chrome_options(opts, settings)
        _aplicar_logging_chromium(opts)
        driver = webdriver.Chrome(options=opts)
    elif name == "firefox":
        opts = FirefoxOptions()
        _headless_firefox_options(opts, settings)
        driver = webdriver.Firefox(options=opts)
    else:
        raise ValueError(
            f"Navegador não suportado: {name!r}. Use edge, chrome ou firefox no settings.ini ou AUTOMATION_BROWSER."
        )

    driver.implicitly_wait(0)
    driver.maximize_window()
    return driver
