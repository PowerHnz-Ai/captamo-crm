-- Auditoria de acesso a conversas (LGPD): registra quando gerente/líder abre uma
-- conversa. Suporta o novo acesso supervisório (leitura para instrução/treinamento).

-- CreateTable
CREATE TABLE `conversation_access_log` (
    `id` VARCHAR(32) NOT NULL,
    `company_id` VARCHAR(64) NOT NULL,
    `conversation_id` VARCHAR(64) NOT NULL,
    `user_uid` VARCHAR(64) NULL,
    `user_name` VARCHAR(160) NULL,
    `role` VARCHAR(32) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `conversation_access_log_company_id_conversation_id_idx`(`company_id`, `conversation_id`),
    INDEX `conversation_access_log_company_id_created_at_idx`(`company_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
