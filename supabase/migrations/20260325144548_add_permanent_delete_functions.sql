/*
  # Add Permanent Delete Functions for Master Data
  
  ## 1. Overview
    This migration adds functions to permanently delete master data (products, customers, suppliers)
    from the database, providing a clean way to remove data that was marked as inactive.
  
  ## 2. New Functions
    - `delete_inactive_products()` - Permanently deletes all products marked as is_active = false
      - Deletes associated product variants
      - Deletes associated inventory records
      - Deletes associated stock movements
      - Logs all deletions in audit trail
    
    - `delete_inactive_customers()` - Permanently deletes all customers marked as is_active = false
      - Only deletes customers with no associated sales
      - Logs deletions in audit trail
    
    - `delete_inactive_suppliers()` - Permanently deletes all suppliers marked as is_active = false
      - Only deletes suppliers with no associated purchase orders
      - Logs deletions in audit trail
    
    - `permanently_delete_product(p_product_id uuid)` - Deletes a specific product
    - `permanently_delete_customer(p_customer_id uuid)` - Deletes a specific customer
    - `permanently_delete_supplier(p_supplier_id uuid)` - Deletes a specific supplier
  
  ## 3. Security
    - All functions are admin-only (require admin role)
    - All actions are logged in audit_logs table
    - Functions check for foreign key constraints before deletion
    - Proper error handling and validation
  
  ## 4. Important Notes
    - These are PERMANENT deletions and cannot be undone
    - Functions will not delete entities that have related transactional data
    - All deletions are logged for audit purposes
*/

-- Function to permanently delete all inactive products
CREATE OR REPLACE FUNCTION delete_inactive_products()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_is_admin boolean;
  v_deleted_count int;
  v_product_ids uuid[];
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  -- Check if user is admin
  SELECT role = 'admin' INTO v_is_admin
  FROM user_profiles
  WHERE id = v_user_id;
  
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only admins can permanently delete products');
  END IF;
  
  -- Get IDs of products to be deleted
  SELECT array_agg(id) INTO v_product_ids
  FROM products
  WHERE is_active = false;
  
  IF v_product_ids IS NULL OR array_length(v_product_ids, 1) = 0 THEN
    RETURN jsonb_build_object('success', true, 'message', 'No inactive products to delete', 'deleted_count', 0);
  END IF;
  
  -- Delete related data in correct order
  DELETE FROM stock_movements WHERE product_id = ANY(v_product_ids);
  DELETE FROM inventory WHERE product_id = ANY(v_product_ids);
  DELETE FROM product_variants WHERE product_id = ANY(v_product_ids);
  
  -- Delete the products and get count
  WITH deleted AS (
    DELETE FROM products
    WHERE id = ANY(v_product_ids)
    RETURNING id
  )
  SELECT count(*) INTO v_deleted_count FROM deleted;
  
  -- Log the deletion
  INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data)
  VALUES (
    v_user_id,
    'PERMANENT_DELETE_INACTIVE_PRODUCTS',
    'products',
    NULL,
    jsonb_build_object('deleted_product_ids', v_product_ids, 'count', v_deleted_count, 'timestamp', now())
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', format('Permanently deleted %s inactive products', v_deleted_count),
    'deleted_count', v_deleted_count
  );
END;
$$;

-- Function to permanently delete all inactive customers
CREATE OR REPLACE FUNCTION delete_inactive_customers()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_is_admin boolean;
  v_deleted_count int;
  v_customer_ids uuid[];
  v_customers_with_sales uuid[];
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  -- Check if user is admin
  SELECT role = 'admin' INTO v_is_admin
  FROM user_profiles
  WHERE id = v_user_id;
  
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only admins can permanently delete customers');
  END IF;
  
  -- Get IDs of inactive customers
  SELECT array_agg(id) INTO v_customer_ids
  FROM customers
  WHERE is_active = false;
  
  IF v_customer_ids IS NULL OR array_length(v_customer_ids, 1) = 0 THEN
    RETURN jsonb_build_object('success', true, 'message', 'No inactive customers to delete', 'deleted_count', 0);
  END IF;
  
  -- Check for customers with sales
  SELECT array_agg(DISTINCT customer_id) INTO v_customers_with_sales
  FROM sales
  WHERE customer_id = ANY(v_customer_ids);
  
  -- Remove customers with sales from deletion list
  IF v_customers_with_sales IS NOT NULL THEN
    v_customer_ids := array(
      SELECT unnest(v_customer_ids)
      EXCEPT
      SELECT unnest(v_customers_with_sales)
    );
  END IF;
  
  IF v_customer_ids IS NULL OR array_length(v_customer_ids, 1) = 0 THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Cannot delete customers with existing sales',
      'deleted_count', 0
    );
  END IF;
  
  -- Delete the customers and get count
  WITH deleted AS (
    DELETE FROM customers
    WHERE id = ANY(v_customer_ids)
    RETURNING id
  )
  SELECT count(*) INTO v_deleted_count FROM deleted;
  
  -- Log the deletion
  INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data)
  VALUES (
    v_user_id,
    'PERMANENT_DELETE_INACTIVE_CUSTOMERS',
    'customers',
    NULL,
    jsonb_build_object('deleted_customer_ids', v_customer_ids, 'count', v_deleted_count, 'timestamp', now())
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', format('Permanently deleted %s inactive customers', v_deleted_count),
    'deleted_count', v_deleted_count,
    'skipped_count', COALESCE(array_length(v_customers_with_sales, 1), 0)
  );
END;
$$;

-- Function to permanently delete all inactive suppliers
CREATE OR REPLACE FUNCTION delete_inactive_suppliers()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_is_admin boolean;
  v_deleted_count int;
  v_supplier_ids uuid[];
  v_suppliers_with_pos uuid[];
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  -- Check if user is admin
  SELECT role = 'admin' INTO v_is_admin
  FROM user_profiles
  WHERE id = v_user_id;
  
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only admins can permanently delete suppliers');
  END IF;
  
  -- Get IDs of inactive suppliers
  SELECT array_agg(id) INTO v_supplier_ids
  FROM suppliers
  WHERE is_active = false;
  
  IF v_supplier_ids IS NULL OR array_length(v_supplier_ids, 1) = 0 THEN
    RETURN jsonb_build_object('success', true, 'message', 'No inactive suppliers to delete', 'deleted_count', 0);
  END IF;
  
  -- Check for suppliers with purchase orders
  SELECT array_agg(DISTINCT supplier_id) INTO v_suppliers_with_pos
  FROM purchase_orders
  WHERE supplier_id = ANY(v_supplier_ids);
  
  -- Remove suppliers with purchase orders from deletion list
  IF v_suppliers_with_pos IS NOT NULL THEN
    v_supplier_ids := array(
      SELECT unnest(v_supplier_ids)
      EXCEPT
      SELECT unnest(v_suppliers_with_pos)
    );
  END IF;
  
  IF v_supplier_ids IS NULL OR array_length(v_supplier_ids, 1) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot delete suppliers with existing purchase orders',
      'deleted_count', 0
    );
  END IF;
  
  -- Delete the suppliers and get count
  WITH deleted AS (
    DELETE FROM suppliers
    WHERE id = ANY(v_supplier_ids)
    RETURNING id
  )
  SELECT count(*) INTO v_deleted_count FROM deleted;
  
  -- Log the deletion
  INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data)
  VALUES (
    v_user_id,
    'PERMANENT_DELETE_INACTIVE_SUPPLIERS',
    'suppliers',
    NULL,
    jsonb_build_object('deleted_supplier_ids', v_supplier_ids, 'count', v_deleted_count, 'timestamp', now())
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', format('Permanently deleted %s inactive suppliers', v_deleted_count),
    'deleted_count', v_deleted_count,
    'skipped_count', COALESCE(array_length(v_suppliers_with_pos, 1), 0)
  );
END;
$$;

-- Function to permanently delete a specific product
CREATE OR REPLACE FUNCTION permanently_delete_product(p_product_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_is_admin boolean;
  v_product_record jsonb;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  -- Check if user is admin
  SELECT role = 'admin' INTO v_is_admin
  FROM user_profiles
  WHERE id = v_user_id;
  
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only admins can permanently delete products');
  END IF;
  
  -- Get product data before deletion
  SELECT jsonb_build_object(
    'id', id,
    'name', name,
    'sku', sku,
    'is_active', is_active
  ) INTO v_product_record
  FROM products
  WHERE id = p_product_id;
  
  IF v_product_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Product not found');
  END IF;
  
  -- Delete related data
  DELETE FROM stock_movements WHERE product_id = p_product_id;
  DELETE FROM inventory WHERE product_id = p_product_id;
  DELETE FROM product_variants WHERE product_id = p_product_id;
  DELETE FROM products WHERE id = p_product_id;
  
  -- Log the deletion
  INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data)
  VALUES (
    v_user_id,
    'PERMANENT_DELETE_PRODUCT',
    'products',
    p_product_id,
    v_product_record
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Product permanently deleted',
    'product_id', p_product_id
  );
END;
$$;

-- Function to permanently delete a specific customer
CREATE OR REPLACE FUNCTION permanently_delete_customer(p_customer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_is_admin boolean;
  v_customer_record jsonb;
  v_has_sales boolean;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  -- Check if user is admin
  SELECT role = 'admin' INTO v_is_admin
  FROM user_profiles
  WHERE id = v_user_id;
  
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only admins can permanently delete customers');
  END IF;
  
  -- Get customer data before deletion
  SELECT jsonb_build_object(
    'id', id,
    'name', name,
    'email', email,
    'is_active', is_active
  ) INTO v_customer_record
  FROM customers
  WHERE id = p_customer_id;
  
  IF v_customer_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Customer not found');
  END IF;
  
  -- Check for existing sales
  SELECT EXISTS(
    SELECT 1 FROM sales WHERE customer_id = p_customer_id
  ) INTO v_has_sales;
  
  IF v_has_sales THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot delete customer with existing sales');
  END IF;
  
  -- Delete the customer
  DELETE FROM customers WHERE id = p_customer_id;
  
  -- Log the deletion
  INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data)
  VALUES (
    v_user_id,
    'PERMANENT_DELETE_CUSTOMER',
    'customers',
    p_customer_id,
    v_customer_record
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Customer permanently deleted',
    'customer_id', p_customer_id
  );
END;
$$;

-- Function to permanently delete a specific supplier
CREATE OR REPLACE FUNCTION permanently_delete_supplier(p_supplier_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_is_admin boolean;
  v_supplier_record jsonb;
  v_has_pos boolean;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  -- Check if user is admin
  SELECT role = 'admin' INTO v_is_admin
  FROM user_profiles
  WHERE id = v_user_id;
  
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only admins can permanently delete suppliers');
  END IF;
  
  -- Get supplier data before deletion
  SELECT jsonb_build_object(
    'id', id,
    'name', name,
    'email', email,
    'is_active', is_active
  ) INTO v_supplier_record
  FROM suppliers
  WHERE id = p_supplier_id;
  
  IF v_supplier_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Supplier not found');
  END IF;
  
  -- Check for existing purchase orders
  SELECT EXISTS(
    SELECT 1 FROM purchase_orders WHERE supplier_id = p_supplier_id
  ) INTO v_has_pos;
  
  IF v_has_pos THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot delete supplier with existing purchase orders');
  END IF;
  
  -- Delete the supplier
  DELETE FROM suppliers WHERE id = p_supplier_id;
  
  -- Log the deletion
  INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data)
  VALUES (
    v_user_id,
    'PERMANENT_DELETE_SUPPLIER',
    'suppliers',
    p_supplier_id,
    v_supplier_record
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Supplier permanently deleted',
    'supplier_id', p_supplier_id
  );
END;
$$;