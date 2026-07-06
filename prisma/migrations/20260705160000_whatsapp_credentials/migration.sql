-- Credenciais da API oficial por empresa: token criptografado (AES-256-GCM)
-- em company_settings (fonte de verdade) e connections (precedência por número).

-- AlterTable
ALTER TABLE `company_settings`
    ADD COLUMN `api_key_secret` TEXT NULL,
    ADD COLUMN `api_key_last4` VARCHAR(8) NULL,
    ADD COLUMN `configured_at` DATETIME(3) NULL,
    ADD COLUMN `configured_by` VARCHAR(64) NULL;

-- AlterTable
ALTER TABLE `connections`
    ADD COLUMN `api_key_secret` TEXT NULL;
