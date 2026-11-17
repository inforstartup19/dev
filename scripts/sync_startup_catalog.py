"""Generate the buildless Site catalogue from the shared React/Site source."""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("--site", type=Path)
args = parser.parse_args()
source = ROOT / "shared/startup-pathways.json"
value = json.loads(source.read_text())
content = "/* Generated from shared/startup-pathways.json; do not edit by hand. */\n"
content += "(function(root){const catalog=" + json.dumps(value, ensure_ascii=False) + ";"
content += "if(typeof module==='object'&&module.exports)module.exports=catalog;else root.QuelcomStartupCatalog=catalog;})(typeof globalThis!=='undefined'?globalThis:this);\n"
paths = [ROOT / "sites/incforstartup/public/startup-catalog.js"]
if args.site:
    paths.append(args.site / "dist/startup-catalog.js")
    (args.site / "data").mkdir(exist_ok=True)
    (args.site / "data/startup-pathways.json").write_text(source.read_text())
for path in paths:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)
