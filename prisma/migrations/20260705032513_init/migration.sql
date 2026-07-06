-- CreateTable
CREATE TABLE `company_settings` (
    `company_id` VARCHAR(64) NOT NULL,
    `provider` VARCHAR(32) NULL,
    `phone_number_id` VARCHAR(64) NULL,
    `waba_id` VARCHAR(64) NULL,
    `instance_id` VARCHAR(128) NULL,
    `api_key_ref` VARCHAR(128) NULL,
    `webhook_verify_token` VARCHAR(128) NULL,
    `messaging_limit_tier` INTEGER NULL,
    `daily_cap` INTEGER NULL,
    `base_url` VARCHAR(255) NULL,
    `assignment_settings` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `company_settings_phone_number_id_idx`(`phone_number_id`),
    INDEX `company_settings_instance_id_idx`(`instance_id`),
    PRIMARY KEY (`company_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `connections` (
    `id` VARCHAR(32) NOT NULL,
    `company_id` VARCHAR(64) NOT NULL,
    `label` VARCHAR(120) NOT NULL,
    `provider` VARCHAR(32) NOT NULL,
    `status` VARCHAR(24) NOT NULL DEFAULT 'disconnected',
    `instance_id` VARCHAR(128) NULL,
    `phone_number` VARCHAR(32) NULL,
    `base_url` VARCHAR(255) NULL,
    `api_key_ref` VARCHAR(128) NULL,
    `phone_number_id` VARCHAR(64) NULL,
    `waba_id` VARCHAR(64) NULL,
    `messaging_limit_tier` INTEGER NULL,
    `daily_cap` INTEGER NULL,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `connections_company_id_idx`(`company_id`),
    INDEX `connections_phone_number_id_idx`(`phone_number_id`),
    INDEX `connections_instance_id_idx`(`instance_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contacts` (
    `id` VARCHAR(32) NOT NULL,
    `company_id` VARCHAR(64) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `phone` VARCHAR(32) NOT NULL,
    `phone_normalized` VARCHAR(32) NOT NULL,
    `source` VARCHAR(80) NOT NULL DEFAULT '',
    `tags` JSON NULL,
    `opt_in` BOOLEAN NOT NULL DEFAULT true,
    `blocked` BOOLEAN NOT NULL DEFAULT false,
    `archived` BOOLEAN NOT NULL DEFAULT false,
    `notes` TEXT NULL,
    `custom_fields` JSON NULL,
    `origin_id` VARCHAR(32) NULL,
    `origin_fields` JSON NULL,
    `lead_class` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `contacts_company_id_phone_normalized_idx`(`company_id`, `phone_normalized`),
    INDEX `contacts_company_id_created_at_idx`(`company_id`, `created_at`),
    INDEX `contacts_company_id_lead_class_idx`(`company_id`, `lead_class`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contact_lists` (
    `id` VARCHAR(32) NOT NULL,
    `company_id` VARCHAR(64) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `description` VARCHAR(500) NULL,
    `tag_filter` JSON NULL,
    `contact_ids` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `contact_lists_company_id_idx`(`company_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `conversations` (
    `id` VARCHAR(32) NOT NULL,
    `company_id` VARCHAR(64) NOT NULL,
    `contact_id` VARCHAR(32) NOT NULL,
    `phone` VARCHAR(32) NOT NULL,
    `phone_normalized` VARCHAR(32) NOT NULL,
    `status` VARCHAR(16) NOT NULL DEFAULT 'open',
    `last_message_at` DATETIME(3) NOT NULL,
    `last_inbound_at` DATETIME(3) NULL,
    `last_message_preview` VARCHAR(500) NULL,
    `unread_count` INTEGER NOT NULL DEFAULT 0,
    `assigned_to` VARCHAR(64) NULL,
    `assigned_at` DATETIME(3) NULL,
    `first_response_at` DATETIME(3) NULL,
    `connection_id` VARCHAR(32) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `conversations_company_id_last_message_at_idx`(`company_id`, `last_message_at` DESC),
    INDEX `conversations_company_id_status_idx`(`company_id`, `status`),
    INDEX `conversations_company_id_assigned_to_idx`(`company_id`, `assigned_to`),
    INDEX `conversations_company_id_phone_normalized_idx`(`company_id`, `phone_normalized`),
    INDEX `conversations_contact_id_idx`(`contact_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `messages` (
    `id` VARCHAR(32) NOT NULL,
    `conversation_id` VARCHAR(32) NOT NULL,
    `contact_id` VARCHAR(32) NOT NULL,
    `company_id` VARCHAR(64) NULL,
    `whatsapp_message_id` VARCHAR(128) NULL,
    `direction` VARCHAR(16) NOT NULL,
    `type` VARCHAR(24) NOT NULL DEFAULT 'text',
    `body` TEXT NOT NULL,
    `status` VARCHAR(24) NOT NULL DEFAULT 'received',
    `media` JSON NULL,
    `template_name` VARCHAR(160) NULL,
    `template_parameters` JSON NULL,
    `template_rendered_body` TEXT NULL,
    `template_footer` VARCHAR(255) NULL,
    `template_buttons` JSON NULL,
    `reply_to` JSON NULL,
    `reactions` JSON NULL,
    `interactive_payload` TEXT NULL,
    `raw_payload` JSON NULL,
    `status_error` TEXT NULL,
    `connection_id` VARCHAR(32) NULL,
    `deleted_at` DATETIME(3) NULL,
    `sent_by_uid` VARCHAR(64) NULL,
    `sent_by_name` VARCHAR(120) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `messages_conversation_id_created_at_idx`(`conversation_id`, `created_at`),
    INDEX `messages_whatsapp_message_id_idx`(`whatsapp_message_id`),
    INDEX `messages_company_id_direction_idx`(`company_id`, `direction`),
    INDEX `messages_company_id_status_idx`(`company_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `templates` (
    `id` VARCHAR(64) NOT NULL,
    `company_id` VARCHAR(64) NULL,
    `name` VARCHAR(160) NOT NULL,
    `language` VARCHAR(16) NOT NULL DEFAULT 'pt_BR',
    `category` VARCHAR(32) NOT NULL DEFAULT 'utility',
    `status` VARCHAR(24) NOT NULL DEFAULT 'draft',
    `body` TEXT NOT NULL,
    `header` JSON NULL,
    `variable_samples` JSON NULL,
    `footer` VARCHAR(255) NULL,
    `buttons` JSON NULL,
    `provider` VARCHAR(32) NULL,
    `meta_template_id` VARCHAR(64) NULL,
    `requires_meta_approval` BOOLEAN NULL,
    `submitted_at` DATETIME(3) NULL,
    `approved_at` DATETIME(3) NULL,
    `rejection_reason` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `templates_company_id_name_idx`(`company_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `campaigns` (
    `id` VARCHAR(32) NOT NULL,
    `company_id` VARCHAR(64) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `template_name` VARCHAR(160) NOT NULL,
    `template_language` VARCHAR(16) NOT NULL DEFAULT 'pt_BR',
    `status` VARCHAR(16) NOT NULL DEFAULT 'draft',
    `contact_list_id` VARCHAR(32) NULL,
    `audience_type` VARCHAR(24) NULL,
    `audience_config` JSON NULL,
    `total_contacts` INTEGER NOT NULL DEFAULT 0,
    `sent_count` INTEGER NOT NULL DEFAULT 0,
    `failed_count` INTEGER NOT NULL DEFAULT 0,
    `skipped_count` INTEGER NOT NULL DEFAULT 0,
    `max_sends_per_run` INTEGER NULL,
    `parameter_mapping` JSON NULL,
    `contact_origin_id` VARCHAR(32) NULL,
    `contact_origin_key` VARCHAR(80) NULL,
    `dispatch_mode` VARCHAR(16) NULL,
    `cadence_config` JSON NULL,
    `scheduled_at` DATETIME(3) NULL,
    `scheduled_end_at` DATETIME(3) NULL,
    `daily_send_limit` INTEGER NULL,
    `daily_sent_date` VARCHAR(16) NULL,
    `daily_sent_count` INTEGER NULL,
    `quiet_hours` JSON NULL,
    `duplicate_policy` VARCHAR(24) NULL,
    `exclude_recent_days` INTEGER NULL,
    `exclude_tags` JSON NULL,
    `exclude_lead_classes` JSON NULL,
    `import_stats` JSON NULL,
    `header_image_asset_id` VARCHAR(32) NULL,
    `header_image_storage_path` VARCHAR(500) NULL,
    `header_image_mode` VARCHAR(16) NULL,
    `header_image_mapping` VARCHAR(160) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `campaigns_company_id_created_at_idx`(`company_id`, `created_at` DESC),
    INDEX `campaigns_company_id_status_idx`(`company_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `campaign_jobs` (
    `id` VARCHAR(32) NOT NULL,
    `campaign_id` VARCHAR(32) NOT NULL,
    `company_id` VARCHAR(64) NOT NULL,
    `contact_id` VARCHAR(32) NOT NULL,
    `phone` VARCHAR(32) NOT NULL,
    `contact_name` VARCHAR(160) NULL,
    `parameters` JSON NOT NULL,
    `header_image_storage_path` VARCHAR(500) NULL,
    `header_image_link` VARCHAR(1000) NULL,
    `status` VARCHAR(16) NOT NULL DEFAULT 'pending',
    `scheduled_at` DATETIME(3) NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `last_error` TEXT NULL,
    `whatsapp_message_id` VARCHAR(128) NULL,
    `delivery_phone` VARCHAR(32) NULL,
    `message_status` VARCHAR(24) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `campaign_jobs_campaign_id_status_scheduled_at_idx`(`campaign_id`, `status`, `scheduled_at`),
    INDEX `campaign_jobs_whatsapp_message_id_idx`(`whatsapp_message_id`),
    INDEX `campaign_jobs_contact_id_status_idx`(`contact_id`, `status`),
    INDEX `campaign_jobs_company_id_contact_id_created_at_idx`(`company_id`, `contact_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quick_replies` (
    `id` VARCHAR(32) NOT NULL,
    `company_id` VARCHAR(64) NOT NULL,
    `title` VARCHAR(120) NOT NULL,
    `body` TEXT NOT NULL,
    `scope` VARCHAR(16) NOT NULL DEFAULT 'company',
    `created_by` VARCHAR(64) NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `quick_replies_company_id_scope_sort_order_idx`(`company_id`, `scope`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contact_origins` (
    `id` VARCHAR(32) NOT NULL,
    `company_id` VARCHAR(64) NOT NULL,
    `key` VARCHAR(80) NOT NULL,
    `label` VARCHAR(120) NOT NULL,
    `is_system` BOOLEAN NOT NULL DEFAULT false,
    `fields` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `contact_origins_company_id_key_key`(`company_id`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `media_assets` (
    `id` VARCHAR(32) NOT NULL,
    `company_id` VARCHAR(64) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `storage_path` VARCHAR(500) NOT NULL,
    `mime_type` VARCHAR(80) NOT NULL,
    `filename` VARCHAR(255) NOT NULL,
    `source` VARCHAR(16) NOT NULL DEFAULT 'manual',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `media_assets_company_id_created_at_idx`(`company_id`, `created_at` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pipeline_stages` (
    `id` VARCHAR(32) NOT NULL,
    `company_id` VARCHAR(64) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `stage_order` INTEGER NOT NULL DEFAULT 0,
    `color` VARCHAR(16) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `pipeline_stages_company_id_stage_order_idx`(`company_id`, `stage_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `deals` (
    `id` VARCHAR(32) NOT NULL,
    `company_id` VARCHAR(64) NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `contact_id` VARCHAR(32) NOT NULL,
    `stage_id` VARCHAR(32) NOT NULL,
    `value` DOUBLE NULL,
    `source` VARCHAR(80) NULL,
    `assigned_to` VARCHAR(64) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `deals_company_id_stage_id_idx`(`company_id`, `stage_id`),
    INDEX `deals_contact_id_idx`(`contact_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `funnel_events` (
    `id` VARCHAR(32) NOT NULL,
    `company_id` VARCHAR(64) NOT NULL,
    `deal_id` VARCHAR(32) NOT NULL,
    `from_stage_id` VARCHAR(32) NULL,
    `to_stage_id` VARCHAR(32) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `funnel_events_company_id_created_at_idx`(`company_id`, `created_at`),
    INDEX `funnel_events_deal_id_idx`(`deal_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `integration_events` (
    `id` VARCHAR(32) NOT NULL,
    `company_id` VARCHAR(64) NULL,
    `source` VARCHAR(80) NOT NULL,
    `payload` JSON NULL,
    `status` VARCHAR(16) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `integration_events_company_id_created_at_idx`(`company_id`, `created_at` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stats_daily` (
    `id` VARCHAR(96) NOT NULL,
    `company_id` VARCHAR(64) NOT NULL,
    `date` VARCHAR(8) NOT NULL,
    `templates_sent` INTEGER NOT NULL DEFAULT 0,
    `messages_sent` INTEGER NOT NULL DEFAULT 0,
    `messages_received` INTEGER NOT NULL DEFAULT 0,
    `messages_delivered` INTEGER NOT NULL DEFAULT 0,
    `messages_read` INTEGER NOT NULL DEFAULT 0,
    `messages_failed` INTEGER NOT NULL DEFAULT 0,
    `opt_outs` INTEGER NOT NULL DEFAULT 0,
    `unique_recipients_24h` INTEGER NOT NULL DEFAULT 0,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `stats_daily_company_id_date_key`(`company_id`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `webhook_events` (
    `id` VARCHAR(32) NOT NULL,
    `company_id` VARCHAR(64) NOT NULL,
    `provider` VARCHAR(32) NOT NULL,
    `event_type` VARCHAR(64) NOT NULL,
    `phone` VARCHAR(32) NULL,
    `message_id` VARCHAR(128) NULL,
    `status` VARCHAR(16) NOT NULL,
    `error` TEXT NULL,
    `event_count` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `webhook_events_company_id_created_at_idx`(`company_id`, `created_at` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `whatsapp_message_refs` (
    `whatsapp_message_id` VARCHAR(128) NOT NULL,
    `company_id` VARCHAR(64) NOT NULL,
    `conversation_id` VARCHAR(32) NOT NULL,
    `message_id` VARCHAR(32) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `whatsapp_message_refs_conversation_id_idx`(`conversation_id`),
    PRIMARY KEY (`whatsapp_message_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `company_presence` (
    `company_id` VARCHAR(64) NOT NULL,
    `uid` VARCHAR(64) NOT NULL,
    `name` VARCHAR(120) NULL,
    `email` VARCHAR(160) NULL,
    `role` VARCHAR(24) NULL,
    `status` VARCHAR(16) NOT NULL DEFAULT 'online',
    `current_surface` VARCHAR(16) NOT NULL DEFAULT 'api',
    `current_path` VARCHAR(255) NULL,
    `last_seen_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`company_id`, `uid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `messages` ADD CONSTRAINT `messages_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `campaign_jobs` ADD CONSTRAINT `campaign_jobs_campaign_id_fkey` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
