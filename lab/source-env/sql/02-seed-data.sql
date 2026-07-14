/*
    02-seed-data.sql
    Seeds representative data into ContosoSales and ContosoArchive.
    Safe to run more than once: each block only inserts when its table is empty.
*/

USE ContosoSales;
GO

IF NOT EXISTS (SELECT 1 FROM Sales.Customers)
BEGIN
    ;WITH n AS
    (
        SELECT TOP (50) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS i
        FROM sys.all_objects
    )
    INSERT Sales.Customers (CompanyName, ContactNotes, TermsText, CreditLimit)
    SELECT CONCAT(N'Customer ', i),
           CONCAT('Legacy contact notes for customer ', i),
           CONCAT('Net 30 payment terms for customer ', i),
           1000 + (i * 50)
    FROM n;
END
GO

IF NOT EXISTS (SELECT 1 FROM Sales.Products)
BEGIN
    ;WITH n AS
    (
        SELECT TOP (100) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS i
        FROM sys.all_objects
    )
    INSERT Sales.Products (ProductName, UnitPrice, Discontinued)
    SELECT CONCAT(N'Product ', i),
           5 + (i % 50),
           CASE WHEN i % 10 = 0 THEN 1 ELSE 0 END
    FROM n;
END
GO

IF NOT EXISTS (SELECT 1 FROM Sales.Orders)
BEGIN
    ;WITH n AS
    (
        SELECT TOP (300) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS i
        FROM sys.all_objects
    )
    INSERT Sales.Orders (CustomerId, OrderDate, Status)
    SELECT ((i - 1) % 50) + 1,
           DATEADD(DAY, -(i % 365), GETDATE()),
           CASE WHEN i % 4 = 0 THEN 'Closed' ELSE 'Open' END
    FROM n;
END
GO

IF NOT EXISTS (SELECT 1 FROM Sales.OrderLines)
BEGIN
    ;WITH t AS
    (
        SELECT 1 AS k UNION ALL SELECT 2
    )
    INSERT Sales.OrderLines (OrderId, ProductId, Quantity, UnitPrice)
    SELECT o.OrderId,
           ((o.OrderId + t.k) % 100) + 1,
           1 + t.k,
           10 + (o.OrderId % 40)
    FROM Sales.Orders AS o
    CROSS JOIN t;
END
GO

USE ContosoArchive;
GO

IF NOT EXISTS (SELECT 1 FROM Sales.ClosedOrders)
BEGIN
    ;WITH n AS
    (
        SELECT TOP (120) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS i
        FROM sys.all_objects
    )
    INSERT Sales.ClosedOrders (OriginalOrderId, CustomerId, OrderDate, Total, ClosedDate)
    SELECT 10000 + i,
           ((i - 1) % 50) + 1,
           DATEADD(DAY, -(400 + i), GETDATE()),
           100 + i,
           DATEADD(DAY, -(200 + i), GETDATE())
    FROM n;
END
GO
