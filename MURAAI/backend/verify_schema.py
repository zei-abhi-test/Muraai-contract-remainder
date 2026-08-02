import os
import sys
from sqlalchemy import inspect, text
from src.models.contract import db, Product, Contract, ContractLineItem, ContractType

def verify_schema():
    """Verify database schema after migrations"""
    
    inspector = inspect(db.engine)
    
    print("=" * 60)
    print("DATABASE SCHEMA VERIFICATION")
    print("=" * 60)
    
    # Check Product table
    print("\n1. PRODUCT TABLE")
    print("-" * 60)
    product_columns = inspector.get_columns('product')
    product_column_names = [col['name'] for col in product_columns]
    print(f"Columns: {product_column_names}")
    
    required_product_fields = ['sku', 'price', 'description']
    for field in required_product_fields:
        if field in product_column_names:
            print(f"✓ {field} exists")
        else:
            print(f"✗ {field} MISSING")
    
    # Check SKU unique constraint
    product_constraints = inspector.get_unique_constraints('product')
    sku_unique = any('sku' in constraint.get('column_names', []) for constraint in product_constraints)
    if sku_unique:
        print("✓ sku has UNIQUE constraint")
    else:
        print("✗ sku UNIQUE constraint MISSING")
    
    # Check contract_type table
    print("\n2. CONTRACT_TYPE TABLE")
    print("-" * 60)
    if 'contract_type' in inspector.get_table_names():
        print("✓ contract_type table exists")
        ct_columns = inspector.get_columns('contract_type')
        ct_column_names = [col['name'] for col in ct_columns]
        print(f"Columns: {ct_column_names}")
        
        # Check seeded data
        with db.engine.connect() as conn:
            result = conn.execute(text("SELECT COUNT(*) FROM contract_type"))
            count = result.scalar()
            print(f"✓ {count} contract types seeded")
            
            if count > 0:
                result = conn.execute(text("SELECT name FROM contract_type"))
                types = [row[0] for row in result]
                print(f"  Types: {types}")
    else:
        print("✗ contract_type table MISSING")
    
    # Check Contract table
    print("\n3. CONTRACT TABLE")
    print("-" * 60)
    contract_columns = inspector.get_columns('contract')
    contract_column_names = [col['name'] for col in contract_columns]
    print(f"Columns: {contract_column_names}")
    
    if 'contract_type_id' in contract_column_names:
        print("✓ contract_type_id exists")
    else:
        print("✗ contract_type_id MISSING")
    
    # Check foreign key to contract_type
    contract_fks = inspector.get_foreign_keys('contract')
    contract_type_fk = any('contract_type' in fk.get('referred_table', '') for fk in contract_fks)
    if contract_type_fk:
        print("✓ Foreign key to contract_type exists")
    else:
        print("✗ Foreign key to contract_type MISSING")
    
    # Check ContractLineItem table
    print("\n4. CONTRACT_LINE_ITEM TABLE")
    print("-" * 60)
    line_item_columns = inspector.get_columns('contract_line_item')
    line_item_column_names = [col['name'] for col in line_item_columns]
    print(f"Columns: {line_item_column_names}")
    
    required_line_item_fields = ['product_id', 'sku', 'product_name', 'discount', 'tax', 'line_total']
    for field in required_line_item_fields:
        if field in line_item_column_names:
            print(f"✓ {field} exists")
        else:
            print(f"✗ {field} MISSING")
    
    # Check foreign key to product
    line_item_fks = inspector.get_foreign_keys('contract_line_item')
    product_fk = any('product' in fk.get('referred_table', '') for fk in line_item_fks)
    if product_fk:
        print("✓ Foreign key to product exists")
    else:
        print("✗ Foreign key to product MISSING")
    
    # Check existing data migration
    print("\n5. DATA MIGRATION CHECK")
    print("-" * 60)
    with db.engine.connect() as conn:
        # Check products have SKU
        result = conn.execute(text("SELECT COUNT(*) FROM product WHERE sku IS NULL OR sku = ''"))
        null_sku_count = result.scalar()
        if null_sku_count == 0:
            print("✓ All products have SKU")
        else:
            print(f"✗ {null_sku_count} products without SKU")
        
        # Check contract line items have product_name
        result = conn.execute(text("SELECT COUNT(*) FROM contract_line_item WHERE product_name IS NULL OR product_name = ''"))
        null_product_name_count = result.scalar()
        if null_product_name_count == 0:
            print("✓ All line items have product_name")
        else:
            print(f"✗ {null_product_name_count} line items without product_name")
    
    print("\n" + "=" * 60)
    print("VERIFICATION COMPLETE")
    print("=" * 60)

if __name__ == '__main__':
    from src.main import app
    with app.app_context():
        verify_schema()
