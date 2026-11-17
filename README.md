# AALCGT

Site publié : [https://dickoadama.github.io/AALCGT/](https://dickoadama.github.io/AALCGT/). Un push vers `main` déclenche le déploiement GitHub Pages.

Application de gestion de l’association. L’interface se connecte directement à Supabase depuis le navigateur : aucun serveur Express ni base de données locale n’est nécessaire à l’exécution.

## Configuration Supabase

1. Créez un projet Supabase.
2. Dans **SQL Editor**, exécutez le contenu de [`supabase/schema.sql`](./supabase/schema.sql). Ce schéma crée les profils, les données de l’application et les règles RLS. Exécutez-le sur le projet destiné à cette application.
3. Dans **Project Settings → API**, copiez l’URL du projet et la clé publique **anon/publishable** dans [`supabase-config.js`](./supabase-config.js) :

   ```js
   window.AALCGT_SUPABASE_CONFIG = {
       url: 'https://VOTRE-PROJET.supabase.co',
       anonKey: 'VOTRE-CLE-PUBLIQUE'
   };
   ```

   La clé publique est destinée au navigateur et ne donne accès qu’aux opérations permises par RLS. N’insérez jamais une clé `service_role`, un mot de passe ou une chaîne PostgreSQL dans ce fichier.
4. Dans **Authentication → URL Configuration**, définissez la **Site URL** à `https://dickoadama.github.io/AALCGT/` et ajoutez `https://dickoadama.github.io/AALCGT/**` aux **Redirect URLs**. Le formulaire de confirmation et la réinitialisation utilisent l’adresse de la page ouverte. Si un ancien lien de confirmation pointe vers `localhost`, corrigez ces URL puis utilisez **Renvoyer le lien** dans l’onglet Inscription; l’ancien courriel restera invalide.
5. Le site est publié automatiquement par GitHub Pages à chaque mise à jour de la branche `main` : [https://dickoadama.github.io/AALCGT/](https://dickoadama.github.io/AALCGT/). La connexion à Supabase requiert Internet; aucun serveur Express n’est nécessaire.

## Premier super-administrateur

Les nouveaux comptes s’inscrivent eux-mêmes depuis l’onglet **Inscription** et reçoivent le rôle membre par défaut. Après avoir inscrit votre propre compte, exécutez dans le SQL Editor Supabase, en remplaçant le nom d’utilisateur :

```sql
BEGIN;
ALTER TABLE public.profiles DISABLE TRIGGER protect_profile_roles_before_update;
UPDATE public.profiles
SET role = 'superadmin'
WHERE username = 'VOTRE_NOM_UTILISATEUR' AND role = 'membre';
ALTER TABLE public.profiles ENABLE TRIGGER protect_profile_roles_before_update;
COMMIT;
```

Vérifiez d’abord que le `SELECT` renvoie exactement votre compte. Cette opération initiale doit être exécutée dans le SQL Editor Supabase; elle désactive temporairement le trigger de protection, le réactive dans la même transaction, et ne doit être faite que pour le premier compte. En cas d’erreur SQL, annulez la transaction avec `ROLLBACK`. Le super-administrateur peut ensuite attribuer les autorisations prévues aux membres et administrateurs. Les membres créent leur propre compte; un administrateur peut gérer leur profil après inscription, mais ne peut pas créer ou choisir leur mot de passe.

## Sécurité et données

Supabase Auth gère les sessions et les mots de passe. Les tables utilisent les politiques **Row Level Security (RLS)** définies dans [`supabase/schema.sql`](./supabase/schema.sql); les contrôles d’accès ne reposent pas seulement sur l’interface JavaScript. Le répertoire partagé expose seulement les champs prévus pour l’annuaire; les autres profils complets ne sont accessibles qu’à leur propriétaire et aux gestionnaires autorisés. Les messages sont limités à leurs participants et aux rôles autorisés.

La clé anon/publishable est visible par les visiteurs du site : c’est normal. La sécurité dépend des règles RLS. Vérifiez-les avant de modifier le schéma ou de déployer. Ne publiez jamais de sauvegarde contenant des données personnelles ou des messages privés.

Aucun effacement de données distantes n’est lancé automatiquement. Pour réinitialiser un projet, vérifiez d’abord son identité et supprimez les lignes explicitement depuis Supabase. Le lien **Réinitialiser les données** dans l’application efface uniquement le stockage local du navigateur.

Les profils sont recréés lors de l’inscription des membres. Les anciens mots de passe locaux ne sont pas transférés.
