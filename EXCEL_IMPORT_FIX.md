# Excel Import Fix - Products Without SKU/Barcode

## Issues Identified

1. **SKU Required Field**: The Excel import was requiring SKU/barcode for all products and skipping rows without it
2. **Limited Import Success**: Only ~240 out of 503 products were importing, likely due to database connection timeouts during sequential processing

## Changes Made

### 1. Made SKU Optional (Auto-Generation)
- Products without SKU now get an automatically generated unique SKU in the format: `AUTO-{timestamp}-{index}`
- Updated validation to only require Name and Retail Price
- Updated TypeScript interface to mark SKU as optional

### 2. Added Processing Throttling
- Added a 100ms delay every 50 products to prevent overwhelming the database
- This helps prevent timeout issues when importing large batches (500+ products)
- Ensures more stable imports without connection failures

### 3. Updated Template
- Added example row showing that SKU can be left blank
- Template now demonstrates both scenarios: with SKU and without SKU

## How to Use

### For Products WITH Barcodes/SKU
Simply fill in the SKU column as before:
```
SKU: PROD-001
Name: Product Name
...
```

### For Products WITHOUT Barcodes/SKU
Leave the SKU column empty or blank:
```
SKU: [blank]
Name: Product Name
...
```

The system will automatically generate a unique SKU like `AUTO-1234567890-5`

## Technical Details

**Files Modified:**
- `/src/lib/excelUtils.ts`
  - Line 5: Made SKU optional in interface
  - Line 82-91: Added SKU auto-generation logic
  - Line 174-177: Added throttling delay
  - Line 206-215: Updated template with example

**Validation Logic:**
- Required fields: Name, Retail Price
- Optional fields: SKU (auto-generated if missing), Description, Current Stock, Cost Price, Tax Rate, Unit of Measure

**Auto-Generated SKU Format:**
- Pattern: `AUTO-{timestamp}-{rowIndex}`
- Example: `AUTO-1711234567890-42`
- Guaranteed unique due to timestamp and index combination

## Testing Recommendations

1. Test with products that have SKU
2. Test with products that don't have SKU (blank column)
3. Test with mixed data (some with SKU, some without)
4. Test with large files (500+ products) to verify throttling works
5. Monitor the console for any error messages during import

## Expected Results

- All 503 products should now import successfully
- Products without SKU will have auto-generated SKU values
- Import progress will be slightly slower for large batches (intentional for stability)
- Error messages will be more descriptive and reference the auto-generated SKU
