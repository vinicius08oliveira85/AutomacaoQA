"""Classe base opcional para agrupar testes que compartilham fixtures e helpers futuros."""


class BaseTest:
    """Herde desta classe e use `@pytest.mark.usefixtures("driver", "settings")` quando fizer sentido."""

    pass
