-- Telefone único por empresa: impede contatos duplicados sob concorrência
-- (webhook × import × criação manual). Rodar scripts/dedup-contacts.mjs --apply
-- antes de aplicar se houver duplicados.

-- DropIndex
DROP INDEX `contacts_company_id_phone_normalized_idx` ON `contacts`;

-- CreateIndex
CREATE UNIQUE INDEX `contacts_company_id_phone_normalized_key` ON `contacts`(`company_id`, `phone_normalized`);
