/*
    01-create-legacy-db.sql
    Creates the ContosoSales and ContosoArchive databases for the HVE-SQL demo.
    Includes deprecated data types, cross-database objects, and Service Broker.
    Target: SQL Server 2016 SP2. Run as a sysadmin using Windows authentication.
*/

USE master;
GO

IF DB_ID('ContosoArchive') IS NULL
    CREATE DATABASE ContosoArchive;
GO

IF DB_ID('ContosoSales') IS NULL
    CREATE DATABASE ContosoSales;
GO

-- Service Broker carries messages between the ordering and invoicing modules.
ALTER DATABASE ContosoSales SET ENABLE_BROKER WITH ROLLBACK IMMEDIATE;
GO

/* ---------- ContosoArchive ---------- */
USE ContosoArchive;
GO

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'Sales')
    EXEC('CREATE SCHEMA Sales');
GO

IF OBJECT_ID('Sales.ClosedOrders', 'U') IS NULL
BEGIN
    CREATE TABLE Sales.ClosedOrders
    (
        ClosedOrderId   int IDENTITY(1,1) NOT NULL CONSTRAINT PK_ClosedOrders PRIMARY KEY,
        OriginalOrderId int NOT NULL,
        CustomerId      int NOT NULL,
        OrderDate       datetime NOT NULL,
        Total           money NOT NULL,
        ClosedDate      datetime NOT NULL
    );
END
GO

/* ---------- ContosoSales ---------- */
USE ContosoSales;
GO

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'Sales')
    EXEC('CREATE SCHEMA Sales');
GO

IF OBJECT_ID('Sales.Customers', 'U') IS NULL
BEGIN
    CREATE TABLE Sales.Customers
    (
        CustomerId  int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Customers PRIMARY KEY,
        CompanyName nvarchar(200) NOT NULL,
        ContactNotes text NULL,   -- deprecated data type
        TermsText    ntext NULL,  -- deprecated data type
        LogoImage    image NULL,  -- deprecated data type
        CreditLimit  money NULL,
        CreatedUtc   datetime2(0) NOT NULL CONSTRAINT DF_Customers_CreatedUtc DEFAULT SYSUTCDATETIME()
    );
END
GO

IF OBJECT_ID('Sales.Products', 'U') IS NULL
BEGIN
    CREATE TABLE Sales.Products
    (
        ProductId    int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Products PRIMARY KEY,
        ProductName  nvarchar(200) NOT NULL,
        UnitPrice    money NOT NULL CONSTRAINT DF_Products_UnitPrice DEFAULT (0),
        Discontinued bit NOT NULL CONSTRAINT DF_Products_Discontinued DEFAULT (0)
    );
END
GO

IF OBJECT_ID('Sales.Orders', 'U') IS NULL
BEGIN
    CREATE TABLE Sales.Orders
    (
        OrderId    int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Orders PRIMARY KEY,
        CustomerId int NOT NULL CONSTRAINT FK_Orders_Customers REFERENCES Sales.Customers(CustomerId),
        OrderDate  datetime NOT NULL CONSTRAINT DF_Orders_OrderDate DEFAULT (GETDATE()),
        Status     varchar(20) NOT NULL CONSTRAINT DF_Orders_Status DEFAULT ('Open')
    );
END
GO

IF OBJECT_ID('Sales.OrderLines', 'U') IS NULL
BEGIN
    CREATE TABLE Sales.OrderLines
    (
        OrderLineId int IDENTITY(1,1) NOT NULL CONSTRAINT PK_OrderLines PRIMARY KEY,
        OrderId     int NOT NULL CONSTRAINT FK_OrderLines_Orders REFERENCES Sales.Orders(OrderId),
        ProductId   int NOT NULL CONSTRAINT FK_OrderLines_Products REFERENCES Sales.Products(ProductId),
        Quantity    int NOT NULL,
        UnitPrice   money NOT NULL
    );
END
GO

-- Cross-database view: live orders joined to archived orders in ContosoArchive.
CREATE OR ALTER VIEW Sales.vw_AllOrders
AS
    SELECT
        OrderId AS OrderRef,
        CustomerId,
        OrderDate,
        CAST('Live' AS varchar(10)) AS Origin
    FROM Sales.Orders
    UNION ALL
    SELECT
        OriginalOrderId AS OrderRef,
        CustomerId,
        OrderDate,
        CAST('Archived' AS varchar(10)) AS Origin
    FROM ContosoArchive.Sales.ClosedOrders;
GO

-- Cross-database procedure used by reporting.
CREATE OR ALTER PROCEDURE Sales.usp_ReportCustomerHistory
    @CustomerId int
AS
BEGIN
    SET NOCOUNT ON;
    SELECT OrderRef, OrderDate, Origin
    FROM Sales.vw_AllOrders
    WHERE CustomerId = @CustomerId
    ORDER BY OrderDate DESC;
END
GO
