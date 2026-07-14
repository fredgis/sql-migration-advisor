/*
    03-legacy-features.sql
    Adds the operational features that drive the migration decision:
    Service Broker objects, an xp_cmdshell export procedure, a Database Mail alert
    procedure, and a SQL Agent nightly close job.
    Creating these objects does not require the underlying features to be enabled.
*/

USE ContosoSales;
GO

/* ---------- Service Broker ---------- */
IF NOT EXISTS (SELECT 1 FROM sys.service_message_types WHERE name = N'//contoso/OrderMessage')
    CREATE MESSAGE TYPE [//contoso/OrderMessage] VALIDATION = NONE;
GO

IF NOT EXISTS (SELECT 1 FROM sys.service_contracts WHERE name = N'//contoso/OrderContract')
    CREATE CONTRACT [//contoso/OrderContract] ([//contoso/OrderMessage] SENT BY INITIATOR);
GO

IF NOT EXISTS (SELECT 1 FROM sys.service_queues WHERE name = N'OrderQueue')
    CREATE QUEUE Sales.OrderQueue;
GO

IF NOT EXISTS (SELECT 1 FROM sys.services WHERE name = N'//contoso/OrderService')
    CREATE SERVICE [//contoso/OrderService] ON QUEUE Sales.OrderQueue ([//contoso/OrderContract]);
GO

/* ---------- xp_cmdshell export procedure (migration blocker) ---------- */
CREATE OR ALTER PROCEDURE Sales.usp_NightlyExport
AS
BEGIN
    SET NOCOUNT ON;
    -- Legacy: shells out to move the nightly export file to a network share.
    -- Not supported on the managed targets, so this is a migration blocker.
    DECLARE @cmd nvarchar(400) = N'copy /Y D:\exports\orders.csv \\fileserver\contoso\exports\';
    EXEC master.dbo.xp_cmdshell @cmd;
END
GO

/* ---------- Database Mail alert procedure ---------- */
CREATE OR ALTER PROCEDURE Sales.usp_AlertOnFailure
    @Message nvarchar(400)
AS
BEGIN
    SET NOCOUNT ON;
    -- Legacy: sends an operational alert through Database Mail.
    EXEC msdb.dbo.sp_send_dbmail
        @profile_name = N'ContosoAlerts',
        @recipients   = N'ops@contoso.example',
        @subject      = N'Nightly close failed',
        @body         = @Message;
END
GO

/* ---------- SQL Agent nightly close job ---------- */
USE msdb;
GO

BEGIN TRY
    IF EXISTS (SELECT 1 FROM msdb.dbo.sysjobs WHERE name = N'Contoso Nightly Close')
        EXEC msdb.dbo.sp_delete_job @job_name = N'Contoso Nightly Close';

    DECLARE @jobId uniqueidentifier;

    EXEC msdb.dbo.sp_add_job
        @job_name = N'Contoso Nightly Close',
        @enabled = 1,
        @description = N'Runs the nightly export for ContosoSales.',
        @job_id = @jobId OUTPUT;

    EXEC msdb.dbo.sp_add_jobstep
        @job_id = @jobId,
        @step_name = N'Run nightly export',
        @subsystem = N'TSQL',
        @database_name = N'ContosoSales',
        @command = N'EXEC Sales.usp_NightlyExport;';

    IF NOT EXISTS (SELECT 1 FROM msdb.dbo.sysschedules WHERE name = N'Contoso Nightly 0200')
        EXEC msdb.dbo.sp_add_schedule
            @schedule_name = N'Contoso Nightly 0200',
            @freq_type = 4,             -- daily
            @freq_interval = 1,
            @active_start_time = 20000; -- 02:00:00

    EXEC msdb.dbo.sp_attach_schedule
        @job_id = @jobId,
        @schedule_name = N'Contoso Nightly 0200';

    EXEC msdb.dbo.sp_add_jobserver
        @job_id = @jobId,
        @server_name = N'(local)';

    PRINT 'SQL Agent job "Contoso Nightly Close" created.';
END TRY
BEGIN CATCH
    PRINT 'Could not fully create the SQL Agent job (SQL Server Agent may be stopped): ' + ERROR_MESSAGE();
END CATCH
GO
