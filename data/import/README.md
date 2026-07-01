# Data Import Folder

Drop your CSV, JSON, or PDF files here.

When you're ready, go to Claude Chat and say:

**"Process"** or **"Import data"**

Claude will:
1. Read all files in this folder
2. Parse and validate the data
3. Show you a preview
4. Ask for confirmation
5. Insert into Supabase
6. Move processed files to `../processed/`

## Example Files

**markets.csv:**
```
name,address,lat,lng,status,asset_class,score,notes
Downtown Tulsa,123 Main St,36.1539,-95.9928,scouting,multifamily,7.5,Good location
```

**assets.csv:**
```
name,address,market_id,status,asset_class,units,purchase_price,cap_rate
Park Plaza,789 Elm St,1,scouting,multifamily,150,5000000,6.5
```

**deals.csv:**
```
name,stage,notes
Downtown Complex,prospecting,Looking good
```

## Supported Formats

- ✅ CSV (with headers)
- ✅ JSON (array of objects)
- ✅ PDF (text extraction)
- ✅ Plain text (Claude infers structure)
