"""Carrega configurações de settings.ini com override opcional por variáveis de ambiente."""

from __future__ import annotations

import configparser
import os
from dataclasses import dataclass
from pathlib import Path

_CONFIG_DIR = Path(__file__).resolve().parent
_DEFAULT_INI = _CONFIG_DIR / "settings.ini"


@dataclass(frozen=True)
class Settings:
    browser_name: str
    headless: bool
    explicit_wait: int
    base_url: str


def load_settings(ini_path: Path | None = None) -> Settings:
    path = ini_path or _DEFAULT_INI
    parser = configparser.ConfigParser()
    if not parser.read(path, encoding="utf-8"):
        raise FileNotFoundError(f"Arquivo de configuração não encontrado: {path}")

    browser = os.environ.get("AUTOMATION_BROWSER", parser.get("browser", "name", fallback="edge")).strip().lower()
    headless_raw = os.environ.get("AUTOMATION_HEADLESS", parser.get("browser", "headless", fallback="false"))
    headless = str(headless_raw).strip().lower() in ("1", "true", "yes", "on")

    explicit = int(
        os.environ.get(
            "AUTOMATION_EXPLICIT_WAIT",
            parser.get("timeouts", "explicit_wait", fallback="20"),
        )
    )

    base_url = os.environ.get(
        "AUTOMATION_BASE_URL",
        parser.get("app", "base_url", fallback="https://hom-mi.levesaude.com.br"),
    ).rstrip("/")

    return Settings(
        browser_name=browser,
        headless=headless,
        explicit_wait=explicit,
        base_url=base_url,
    )
