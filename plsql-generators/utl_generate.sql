CREATE OR REPLACE PACKAGE "UTL_GENERATE"
as
  function updateStatement(
    object_type IN VARCHAR2,
    name IN VARCHAR2,
    schema IN VARCHAR2,
    selected_object IN VARCHAR2
  ) return clob;
end UTL_GENERATE;
/

CREATE OR REPLACE PACKAGE BODY "UTL_GENERATE"
as
  function updateStatement(
    object_type IN VARCHAR2,
    name IN VARCHAR2,
    schema IN VARCHAR2,
    selected_object IN VARCHAR2
  ) return clob
  is
    v_clob CLOB := NULL;
  begin
    select 'update '|| schema ||'.'||selected_object
    || chr(10) || 'set '
    || chr(10) || listagg(chr(9) || column_name || ' = :' || column_id, ',' || chr(10)) within group (order by column_id)
    || chr(10) || ';'
    into
      v_clob
    from all_tab_columns
    where owner = schema
    and table_name = selected_object
    ;
    return v_clob;
  end updateStatement;
end UTL_GENERATE;
/