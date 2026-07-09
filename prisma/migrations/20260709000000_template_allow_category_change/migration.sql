-- Flag por template: permite a Meta reclassificar a categoria em vez de
-- reprovar (allow_category_change na criação via Graph API).

-- AlterTable
ALTER TABLE `templates` ADD COLUMN `allow_category_change` BOOLEAN NOT NULL DEFAULT false;
