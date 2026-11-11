"""Entrada de escritorio de AudioTaller para Windows."""

import ctypes
import logging
import os
from pathlib import Path
import sqlite3


def main():
    # Guardamos los datos por usuario, fuera de la carpeta del programa.
    datos = Path(os.environ["LOCALAPPDATA"]) / "AudioTaller"
    datos.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(filename=datos / "inicio.log", encoding="utf-8", level=logging.INFO)

    import webview
    from app import app

    # SQLite crea el archivo al abrirlo. Las futuras migraciones definirán
    # las tablas de proyectos y canciones cuando se implemente su gestión.
    base = datos / "audiotaller.sqlite3"
    conexion = sqlite3.connect(base)
    conexion.close()
    app.config.update(DEBUG=False, DATABASE=base)

    # pywebview sirve Flask en una dirección local y muestra la misma página
    # de bienvenida dentro de la ventana. Al cerrarla termina el proceso.
    class Dialogs:
        # Se devuelve la ubicación elegida, sin copiar ni mover el archivo.
        def choose_path(self, folder=False):
            kind = webview.FileDialog.FOLDER if folder else webview.FileDialog.OPEN
            result = webview.windows[0].create_file_dialog(kind, allow_multiple=False)
            return result[0] if result else ''

        def choose_audio_files(self):
            # El usuario puede seleccionar varios archivos de audio en una sola operación.
            result = webview.windows[0].create_file_dialog(
                webview.FileDialog.OPEN, allow_multiple=True
            )
            return list(result) if result else []

        def choose_score_files(self):
            # PDF e imágenes de partituras; se conservan en su ubicación original.
            result = webview.windows[0].create_file_dialog(
                webview.FileDialog.OPEN, allow_multiple=True,
                file_types=(
                    'Partituras (*.pdf;*.png;*.jpg;*.jpeg)',
                    'Todos los archivos (*.*)',
                )
            )
            return list(result) if result else []

        def choose_lyric_files(self):
            # TXT y DOCX; se conservan en su ubicación original.
            result = webview.windows[0].create_file_dialog(
                webview.FileDialog.OPEN, allow_multiple=True,
                file_types=('Letras (*.txt;*.docx)', 'Todos los archivos (*.*)')
            )
            return list(result) if result else []

        def open_lyric_location(self, lyric_id):
            from app import db_open
            with db_open() as db:
                row = db.execute('SELECT ruta FROM lyrics WHERE id=?', (str(lyric_id),)).fetchone()
            if not row: return False
            try:
                archivo = Path(row['ruta']).resolve(strict=True)
                if not archivo.is_file(): return False
                os.startfile(str(archivo.parent))
                return True
            except (OSError, RuntimeError): return False

        def open_score_location(self, score_id):
            from app import db_open
            with db_open() as db:
                row = db.execute('SELECT ruta FROM scores WHERE id=?', (str(score_id),)).fetchone()
            if not row:
                return False
            try:
                archivo = Path(row['ruta']).resolve(strict=True)
                if not archivo.is_file():
                    return False
                os.startfile(str(archivo.parent))
                return True
            except (OSError, RuntimeError):
                return False

        def open_location(self, beat_id):
            # El ID se resuelve contra la biblioteca local; nunca se acepta una ruta del navegador.
            from app import db_open
            with db_open() as db:
                row = db.execute('SELECT ruta FROM beats WHERE id=?', (str(beat_id),)).fetchone()
            if not row:
                return False
            try:
                archivo = Path(row['ruta']).resolve(strict=True)
                if not archivo.is_file():
                    return False
                os.startfile(str(archivo.parent))
                return True
            except (OSError, RuntimeError):
                return False

    webview.create_window("AudioTaller", app, width=1280, height=800, js_api=Dialogs())
    webview.start(gui="edgechromium", debug=False)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        # pythonw.exe arranca sin consola. Mostramos el error en Windows y
        # dejamos el detalle en el registro si se pudo inicializar.
        logging.exception("Error al iniciar AudioTaller")
        ctypes.windll.user32.MessageBoxW(
            None,
            "No se pudo iniciar AudioTaller. Revisa %LOCALAPPDATA%\\AudioTaller\\inicio.log.",
            "AudioTaller",
            0x10,
        )
        raise SystemExit(1)
