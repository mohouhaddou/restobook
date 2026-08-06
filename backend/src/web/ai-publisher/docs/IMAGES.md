# Images

Les WebP sont copiées vers `/uploads/<module>/` avec un nom non prédictible `<module>-YYYYMMDD-<uuid>.webp`. `COPYFILE_EXCL` interdit tout écrasement. Toute image copiée est compensée si la transaction échoue. Le Publisher ne supprime jamais le workspace source.
