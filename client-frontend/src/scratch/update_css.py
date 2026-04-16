import os

css_path = r'c:\Users\badlu\Desktop\Projects\Fleed-Management-System\client-frontend\src\App.css'

with open(css_path, 'r', encoding='latin-1') as f:
    content = f.read()

# Replace main container
content = content.replace(
    '.analytics-filter {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)) auto;\n  align-items: flex-end;\n  gap: 20px;\n}',
    '.analytics-filter {\n  display: flex;\n  flex-wrap: wrap;\n  align-items: flex-end;\n  gap: 20px;\n}'
)

# Replace labels
content = content.replace(
    '.analytics-filter label {\n  display: grid;\n  gap: 8px;\n}',
    '.analytics-filter label {\n  flex: 1;\n  min-width: 200px;\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n}'
)

# Replace actions and add submit
content = content.replace(
    '.analytics-filter__actions {\n  display: flex;\n  align-items: center;\n  gap: 14px;\n}',
    '.analytics-filter__actions {\n  display: flex;\n  align-items: center;\n  gap: 14px;\n}\n\n.analytics-filter__submit {\n  background: #1a4731 !important;\n  color: #fff !important;\n  border-radius: 10px !important;\n  padding: 12px 24px !important;\n  font-weight: 700 !important;\n}\n\n.analytics-filter__submit:hover {\n  background: #143525 !important;\n}'
)

with open(css_path, 'w', encoding='latin-1') as f:
    f.write(content)

print("Update successful")
