-- ============================================================================
-- Base de datos: amigo_invisible
-- Compatible con MySQL 8+ y MariaDB (XAMPP / phpMyAdmin)
-- Charset utf8mb4 para soportar emojis navideños (🎄🎁🎅)
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `amigo_invisible`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `amigo_invisible`;

-- ----------------------------------------------------------------------------
-- Tabla de sorteos (eventos navideños)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `draws` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(150) NOT NULL,
  `event_date` DATE NULL,
  `budget` DECIMAL(10, 2) NULL,
  `currency` VARCHAR(10) NOT NULL DEFAULT '€',
  `custom_message` TEXT NULL,
  `avoid_reciprocal` TINYINT(1) NOT NULL DEFAULT 1,
  `anti_spoiler` TINYINT(1) NOT NULL DEFAULT 1,
  `status` ENUM('draft', 'drawn', 'sent') NOT NULL DEFAULT 'draft',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Tabla de participantes de cada sorteo
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `participants` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `draw_id` INT UNSIGNED NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `phone` VARCHAR(30) NOT NULL,
  `wishlist` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_draw_phone` (`draw_id`, `phone`),
  KEY `idx_participants_draw` (`draw_id`),
  CONSTRAINT `fk_participants_draw`
    FOREIGN KEY (`draw_id`) REFERENCES `draws` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Tabla de exclusiones (giver_id NO puede regalar a excluded_receiver_id)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `exclusions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `draw_id` INT UNSIGNED NOT NULL,
  `giver_id` INT UNSIGNED NOT NULL,
  `excluded_receiver_id` INT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_exclusion_pair` (`draw_id`, `giver_id`, `excluded_receiver_id`),
  KEY `idx_exclusions_draw` (`draw_id`),
  CONSTRAINT `fk_exclusions_draw`
    FOREIGN KEY (`draw_id`) REFERENCES `draws` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_exclusions_giver`
    FOREIGN KEY (`giver_id`) REFERENCES `participants` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_exclusions_receiver`
    FOREIGN KEY (`excluded_receiver_id`) REFERENCES `participants` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Tabla de asignaciones resultantes del sorteo
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `assignments` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `draw_id` INT UNSIGNED NOT NULL,
  `giver_id` INT UNSIGNED NOT NULL,
  `receiver_id` INT UNSIGNED NOT NULL,
  `reveal_token` VARCHAR(64) NOT NULL,
  `whatsapp_status` ENUM('pending', 'sent', 'failed') NOT NULL DEFAULT 'pending',
  `sent_at` TIMESTAMP NULL DEFAULT NULL,
  `revealed_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_assignment_token` (`reveal_token`),
  UNIQUE KEY `uq_assignment_giver` (`draw_id`, `giver_id`),
  UNIQUE KEY `uq_assignment_receiver` (`draw_id`, `receiver_id`),
  KEY `idx_assignments_draw` (`draw_id`),
  CONSTRAINT `fk_assignments_draw`
    FOREIGN KEY (`draw_id`) REFERENCES `draws` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_assignments_giver`
    FOREIGN KEY (`giver_id`) REFERENCES `participants` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_assignments_receiver`
    FOREIGN KEY (`receiver_id`) REFERENCES `participants` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Tabla de logs de envío de WhatsApp (útil para auditoría en phpMyAdmin)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `notification_logs` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `assignment_id` INT UNSIGNED NOT NULL,
  `provider` VARCHAR(40) NOT NULL,
  `status` ENUM('sent', 'failed', 'simulated') NOT NULL,
  `message_preview` TEXT NULL,
  `detail` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_logs_assignment` (`assignment_id`),
  CONSTRAINT `fk_logs_assignment`
    FOREIGN KEY (`assignment_id`) REFERENCES `assignments` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
