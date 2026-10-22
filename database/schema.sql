-- ============================================================
--  RISE AND SHINE — Schéma de la base de données MySQL / MariaDB
-- ============================================================
--  Ce fichier est exécuté automatiquement au démarrage du serveur
--  (CREATE TABLE IF NOT EXISTS : sans effet si les tables existent).
--  Il peut aussi être importé manuellement dans phpMyAdmin (Hostinger).
--
--  Conventions :
--    - id      : UUID (CHAR(36)) généré par l'application
--    - extra   : JSON contenant les champs non prévus par le schéma
--    - dates   : stockées en UTC
-- ============================================================

SET NAMES utf8mb4;

-- ── Utilisateurs (comptes de connexion) ─────────────────────
CREATE TABLE IF NOT EXISTS `users` (
  `id`               CHAR(36)     NOT NULL,
  `nom`              VARCHAR(150) NOT NULL,
  `email`            VARCHAR(190) NOT NULL,
  `password`         VARCHAR(255) NOT NULL,
  `role`             ENUM('super_admin','admin','membre') NOT NULL DEFAULT 'membre',
  `telephone`        VARCHAR(30)  NULL,
  `sexe`             VARCHAR(10)  NULL,
  `age`              INT          NULL,
  `ville`            VARCHAR(100) NULL,
  `avatar`           TEXT         NULL,
  `actif`            TINYINT(1)   NOT NULL DEFAULT 1,
  `adminId`          CHAR(36)     NULL,
  `permissions`      JSON         NULL,
  `dernierConnexion` DATETIME(3)  NULL,
  `extra`            JSON         NULL,
  `createdAt`        DATETIME(3)  NOT NULL,
  `updatedAt`        DATETIME(3)  NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`),
  KEY `idx_users_role` (`role`),
  KEY `idx_users_admin` (`adminId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Profils membres ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `members` (
  `id`           CHAR(36)     NOT NULL,
  `userId`       CHAR(36)     NULL,
  `adminId`      CHAR(36)     NULL,
  `nom`          VARCHAR(150) NOT NULL,
  `email`        VARCHAR(190) NULL,
  `telephone`    VARCHAR(30)  NULL,
  `sexe`         VARCHAR(10)  NULL,
  `age`          INT          NULL,
  `ville`        VARCHAR(100) NULL,
  `statut`       VARCHAR(30)  NOT NULL DEFAULT 'actif',
  `avatar`       TEXT         NULL,
  `notes`        TEXT         NULL,
  `baptise`      TINYINT(1)   NOT NULL DEFAULT 0,
  `dateAdhesion` DATETIME(3)  NULL,
  `extra`        JSON         NULL,
  `createdAt`    DATETIME(3)  NOT NULL,
  `updatedAt`    DATETIME(3)  NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_members_user` (`userId`),
  KEY `idx_members_admin` (`adminId`),
  KEY `idx_members_statut` (`statut`),
  CONSTRAINT `fk_members_user` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Témoignages ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `testimonies` (
  `id`             CHAR(36)     NOT NULL,
  `userId`         CHAR(36)     NULL,
  `auteurNom`      VARCHAR(150) NULL,
  `auteurAvatar`   TEXT         NULL,
  `titre`          VARCHAR(200) NOT NULL,
  `contenu`        TEXT         NOT NULL,
  `type`           VARCHAR(30)  NULL,
  `image`          TEXT         NULL,
  `statut`         VARCHAR(30)  NOT NULL DEFAULT 'en_attente',
  `featured`       TINYINT(1)   NOT NULL DEFAULT 0,
  `likes`          JSON         NULL,
  `commentaires`   JSON         NULL,
  `vues`           INT          NOT NULL DEFAULT 0,
  `moderateurId`   CHAR(36)     NULL,
  `moderateurNom`  VARCHAR(150) NULL,
  `dateModeration` DATETIME(3)  NULL,
  `extra`          JSON         NULL,
  `createdAt`      DATETIME(3)  NOT NULL,
  `updatedAt`      DATETIME(3)  NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_testimonies_user` (`userId`),
  KEY `idx_testimonies_statut` (`statut`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Évangélisation (personnes évangélisées) ─────────────────
CREATE TABLE IF NOT EXISTS `evangelism` (
  `id`                 CHAR(36)     NOT NULL,
  `nom`                VARCHAR(150) NOT NULL,
  `telephone`          VARCHAR(30)  NULL,
  `localisation`       VARCHAR(200) NULL,
  `dateEvangelisation` DATETIME(3)  NULL,
  `demandesPriere`     TEXT         NULL,
  `notes`              TEXT         NULL,
  `statut`             VARCHAR(30)  NOT NULL DEFAULT 'nouveau',
  `membreId`           CHAR(36)     NULL,
  `membreNom`          VARCHAR(150) NULL,
  `memberId`           CHAR(36)     NULL,
  `adminId`            CHAR(36)     NULL,
  `historique`         JSON         NULL,
  `extra`              JSON         NULL,
  `createdAt`          DATETIME(3)  NOT NULL,
  `updatedAt`          DATETIME(3)  NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_evangelism_membre` (`membreId`),
  KEY `idx_evangelism_admin` (`adminId`),
  KEY `idx_evangelism_statut` (`statut`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Finances ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `finances` (
  `id`              CHAR(36)      NOT NULL,
  `type`            VARCHAR(30)   NOT NULL,
  `montant`         DECIMAL(15,2) NOT NULL DEFAULT 0,
  `description`     TEXT          NULL,
  `categorie`       VARCHAR(50)   NULL,
  `dateTransaction` DATETIME(3)   NULL,
  `recu`            TEXT          NULL,
  `evenementId`     CHAR(36)      NULL,
  `statut`          VARCHAR(30)   NOT NULL DEFAULT 'en_attente',
  `soumisParId`     CHAR(36)      NULL,
  `soumisParNom`    VARCHAR(150)  NULL,
  `approbateurId`   CHAR(36)      NULL,
  `approbateurNom`  VARCHAR(150)  NULL,
  `dateApprobation` DATETIME(3)   NULL,
  `extra`           JSON          NULL,
  `createdAt`       DATETIME(3)   NOT NULL,
  `updatedAt`       DATETIME(3)   NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_finances_type` (`type`),
  KEY `idx_finances_statut` (`statut`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Événements ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `events` (
  `id`                    CHAR(36)     NOT NULL,
  `titre`                 VARCHAR(200) NOT NULL,
  `description`           TEXT         NULL,
  `dateDebut`             DATETIME(3)  NULL,
  `dateFin`               DATETIME(3)  NULL,
  `lieu`                  VARCHAR(200) NULL,
  `categorie`             VARCHAR(50)  NULL,
  `intervenants`          JSON         NULL,
  `bannerUrl`             TEXT         NULL,
  `capacite`              INT          NULL,
  `lienInscription`       TEXT         NULL,
  `statut`                VARCHAR(30)  NOT NULL DEFAULT 'a_venir',
  `rsvp`                  JSON         NULL,
  `participantsConfirmes` JSON         NULL,
  `createurId`            CHAR(36)     NULL,
  `createurNom`           VARCHAR(150) NULL,
  `extra`                 JSON         NULL,
  `createdAt`             DATETIME(3)  NOT NULL,
  `updatedAt`             DATETIME(3)  NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_events_date` (`dateDebut`),
  KEY `idx_events_statut` (`statut`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Enseignements ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `teachings` (
  `id`              CHAR(36)     NOT NULL,
  `titre`           VARCHAR(200) NOT NULL,
  `description`     TEXT         NULL,
  `type`            VARCHAR(30)  NULL,
  `categorie`       VARCHAR(50)  NULL,
  `auteur`          VARCHAR(150) NULL,
  `fichierUrl`      TEXT         NULL,
  `lien`            TEXT         NULL,
  `duree`           VARCHAR(50)  NULL,
  `tags`            JSON         NULL,
  `uploadParId`     CHAR(36)     NULL,
  `uploadParNom`    VARCHAR(150) NULL,
  `vues`            INT          NOT NULL DEFAULT 0,
  `telechargements` INT          NOT NULL DEFAULT 0,
  `featured`        TINYINT(1)   NOT NULL DEFAULT 0,
  `extra`           JSON         NULL,
  `createdAt`       DATETIME(3)  NOT NULL,
  `updatedAt`       DATETIME(3)  NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_teachings_categorie` (`categorie`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Rapports confidentiels sur les membres ──────────────────
CREATE TABLE IF NOT EXISTS `reports` (
  `id`              CHAR(36)     NOT NULL,
  `memberId`        CHAR(36)     NULL,
  `membreNom`       VARCHAR(150) NULL,
  `adminId`         CHAR(36)     NULL,
  `adminNom`        VARCHAR(150) NULL,
  `titre`           VARCHAR(200) NOT NULL,
  `contenu`         TEXT         NOT NULL,
  `type`            VARCHAR(30)  NULL,
  `dateObservation` DATETIME(3)  NULL,
  `confidentiel`    TINYINT(1)   NOT NULL DEFAULT 1,
  `extra`           JSON         NULL,
  `createdAt`       DATETIME(3)  NOT NULL,
  `updatedAt`       DATETIME(3)  NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_reports_member` (`memberId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Galerie ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `galleries` (
  `id`           CHAR(36)     NOT NULL,
  `titre`        VARCHAR(200) NULL,
  `imageUrl`     TEXT         NOT NULL,
  `categorie`    VARCHAR(50)  NULL,
  `description`  TEXT         NULL,
  `evenementId`  CHAR(36)     NULL,
  `uploadParId`  CHAR(36)     NULL,
  `uploadParNom` VARCHAR(150) NULL,
  `extra`        JSON         NULL,
  `createdAt`    DATETIME(3)  NOT NULL,
  `updatedAt`    DATETIME(3)  NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Notifications ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `notifications` (
  `id`        CHAR(36)    NOT NULL,
  `userId`    CHAR(36)    NOT NULL,
  `type`      VARCHAR(50) NULL,
  `message`   TEXT        NOT NULL,
  `data`      JSON        NULL,
  `lu`        TINYINT(1)  NOT NULL DEFAULT 0,
  `extra`     JSON        NULL,
  `createdAt` DATETIME(3) NOT NULL,
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_notifications_user` (`userId`, `lu`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Annonces ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `announcements` (
  `id`          CHAR(36)     NOT NULL,
  `titre`       VARCHAR(200) NOT NULL,
  `contenu`     TEXT         NOT NULL,
  `priorite`    VARCHAR(20)  NULL,
  `expireAt`    DATETIME(3)  NULL,
  `actif`       TINYINT(1)   NOT NULL DEFAULT 1,
  `createurId`  CHAR(36)     NULL,
  `createurNom` VARCHAR(150) NULL,
  `extra`       JSON         NULL,
  `createdAt`   DATETIME(3)  NOT NULL,
  `updatedAt`   DATETIME(3)  NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Journal d'activité ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS `logs` (
  `id`         CHAR(36)     NOT NULL,
  `userId`     CHAR(36)     NULL,
  `userNom`    VARCHAR(150) NULL,
  `userRole`   VARCHAR(20)  NULL,
  `action`     VARCHAR(100) NOT NULL,
  `details`    JSON         NULL,
  `ip`         VARCHAR(64)  NULL,
  `method`     VARCHAR(10)  NULL,
  `path`       VARCHAR(255) NULL,
  `statusCode` INT          NULL,
  `extra`      JSON         NULL,
  `createdAt`  DATETIME(3)  NOT NULL,
  `updatedAt`  DATETIME(3)  NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_logs_user` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Paramètres de la plateforme (liens réseaux sociaux, etc.) ──
CREATE TABLE IF NOT EXISTS `settings` (
  `id`        CHAR(36)     NOT NULL,
  `cle`       VARCHAR(100) NOT NULL,
  `valeur`    TEXT         NULL,
  `extra`     JSON         NULL,
  `createdAt` DATETIME(3)  NOT NULL,
  `updatedAt` DATETIME(3)  NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_settings_cle` (`cle`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Demandes d'assistance des membres ───────────────────────
CREATE TABLE IF NOT EXISTS `support_requests` (
  `id`          CHAR(36)     NOT NULL,
  `userId`      CHAR(36)     NULL,
  `userNom`     VARCHAR(150) NULL,
  `userEmail`   VARCHAR(190) NULL,
  `sujet`       VARCHAR(200) NOT NULL,
  `message`     TEXT         NOT NULL,
  `statut`      VARCHAR(30)  NOT NULL DEFAULT 'envoyee',
  `emailEnvoye` TINYINT(1)   NOT NULL DEFAULT 0,
  `extra`       JSON         NULL,
  `createdAt`   DATETIME(3)  NOT NULL,
  `updatedAt`   DATETIME(3)  NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_support_user` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Tables réservées (rôles, permissions, assignations) ─────
CREATE TABLE IF NOT EXISTS `roles` (
  `id`        CHAR(36)    NOT NULL,
  `extra`     JSON        NULL,
  `createdAt` DATETIME(3) NOT NULL,
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `permissions` (
  `id`        CHAR(36)    NOT NULL,
  `extra`     JSON        NULL,
  `createdAt` DATETIME(3) NOT NULL,
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `assignments` (
  `id`        CHAR(36)    NOT NULL,
  `extra`     JSON        NULL,
  `createdAt` DATETIME(3) NOT NULL,
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Sessions de connexion ───────────────────────────────────
CREATE TABLE IF NOT EXISTS `sessions` (
  `session_id` VARCHAR(128) NOT NULL,
  `expires`    BIGINT       NOT NULL,
  `data`       MEDIUMTEXT   NULL,
  PRIMARY KEY (`session_id`),
  KEY `idx_sessions_expires` (`expires`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
