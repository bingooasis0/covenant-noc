from pathlib import Path
path = Path('src/components/noc-dashboard/views.jsx')
text = path.read_text()
text = text.replace("? ')", "? ')" )
