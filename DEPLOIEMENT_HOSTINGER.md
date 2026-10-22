# Déploiement sur Hostinger

Ce guide met en ligne la plateforme Rise And Shine sur Hostinger avec une base MySQL.
Il faut un plan qui permet les applications **Node.js** (Business, Cloud ou VPS).

---

## 1. Créer la base de données MySQL

1. hPanel → **Bases de données** → **Gestion des bases de données MySQL**.
2. Créez une base, un utilisateur et un mot de passe. Notez les trois valeurs
   (Hostinger ajoute un préfixe du type `u123456789_`).
3. Notez aussi l'**hôte** affiché par hPanel. C'est généralement `localhost`.

Vous n'avez **rien à importer** : au premier démarrage, l'application crée
toutes les tables (`database/schema.sql`). Vous pouvez aussi importer ce fichier
vous-même dans phpMyAdmin si vous préférez.

## 2. Créer une adresse e-mail d'envoi

Les e-mails de confirmation d'inscription et les demandes d'assistance partent
par SMTP.

- **Avec une boîte mail Hostinger** (recommandé) : hPanel → **E-mails** → créez par
  exemple `contact@votre-domaine.com`.
  Les réglages sont : `smtp.hostinger.com`, port `465`, SSL.
- **Avec Gmail** : activez la validation en deux étapes du compte Google, puis
  créez un « mot de passe d'application » (Compte Google → Sécurité). Les réglages
  sont : `smtp.gmail.com`, port `465`.

Les demandes d'assistance des membres arrivent sur **riseandshinebf@gmail.com**.
Pour changer cette adresse, modifiez la variable `SUPPORT_EMAIL`.

## 3. Créer l'application Node.js

1. hPanel → **Sites web** → **Ajouter un site web** → **Application Web Node.js**.
2. Choisissez l'import depuis **GitHub**, ou l'**envoi d'une archive .zip** du dossier
   `RiseandShine`. Excluez `node_modules`, `data` et `logs` de l'archive.
3. Paramètres de build :
   - Version de Node.js : **22.x**
   - Fichier d'entrée : `server.js`
   - Commande de démarrage : `npm start`
4. **Variables d'environnement** : ajoutez celles du fichier `.env.example` :

| Variable | Valeur |
|---|---|
| `NODE_ENV` | `production` |
| `SESSION_SECRET` | une longue chaîne aléatoire (au moins 32 caractères) |
| `APP_URL` | `https://votre-domaine.com` |
| `DB_HOST` | hôte noté à l'étape 1 (souvent `localhost`) |
| `DB_PORT` | `3306` |
| `DB_NAME` / `DB_USER` / `DB_PASSWORD` | valeurs de l'étape 1 |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | `smtp.hostinger.com` / `465` / `true` |
| `SMTP_USER` / `SMTP_PASSWORD` | l'adresse e-mail et son mot de passe |
| `MAIL_FROM` | la même adresse que `SMTP_USER` |
| `SUPPORT_EMAIL` | `riseandshinebf@gmail.com` |

5. Déployez. Ouvrez ensuite `https://votre-domaine.com/api/health`. La réponse doit
   contenir `"database":"mysql"`.

## 4. Récupérer les comptes existants (facultatif)

Les comptes déjà créés en local se trouvent dans `data/*.json`. Pour les copier
dans la base Hostinger :

1. hPanel → **Bases de données** → **MySQL distant** : autorisez l'adresse IP de votre
   ordinateur. Notez l'hôte distant affiché (du type `srvXXXX.hstgr.io`).
2. Sur votre ordinateur, dans le dossier `RiseandShine`, créez un fichier `.env`
   à partir de `.env.example`. Mettez dans `DB_HOST` l'hôte distant, puis lancez :

   ```
   npm run db:migrate
   ```

   Vous pouvez relancer le script sans risque : il ignore ce qui existe déjà.
3. Supprimez ensuite l'accès distant dans hPanel.

## 5. Vérifications après la mise en ligne

- **Connexion** : connectez-vous et vérifiez que vous arrivez sur le tableau de bord.
- **E-mails** : créez un compte de test et vérifiez la réception de l'e-mail de
  confirmation (pensez aux spams). En local, `npm run mail:test -- votre@email.com`
  teste les réglages SMTP.
- **Réseaux sociaux** : connecté en Super Admin, ouvrez **Gestion Utilisateurs** puis
  **Liens des Réseaux Sociaux**, saisissez les liens et enregistrez. Ils apparaissent
  aussitôt sur la page d'accueil.
- **Sécurité** : changez immédiatement le mot de passe des deux comptes Super Admin
  par défaut (`superadmin@riseandshine.org` et `admin.general@riseandshine.org`)
  depuis **Paramètres**, ou désactivez-les.

## En cas de problème

| Symptôme | Cause probable |
|---|---|
| L'application ne démarre pas, erreur `ER_ACCESS_DENIED` ou `ECONNREFUSED` | Une des variables `DB_*` est fausse. |
| Retour à la page de connexion après s'être connecté | `SESSION_SECRET` a changé entre deux redémarrages, ou le site n'est pas en HTTPS. |
| « Inscription réussie » sans mention de l'e-mail | Le SMTP n'est pas configuré ou est refusé. Les détails sont dans le dossier `logs/`. |
