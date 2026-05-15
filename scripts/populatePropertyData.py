from pathlib import Path
import runpy


if __name__ == "__main__":
    target = Path(__file__).resolve().parents[1] / "backend" / "scripts" / "populatePropertyData.py"
    runpy.run_path(str(target), run_name="__main__")
