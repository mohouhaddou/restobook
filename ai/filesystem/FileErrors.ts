/** Erreur racine du connecteur de fichiers. */
export class FileSystemConnectorError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "FileSystemConnectorError";
  }
}

/** Signale un chemin qui sort de la racine autorisée. */
export class UnsafePathError extends FileSystemConnectorError {
  public constructor(path: string) {
    super("UNSAFE_PATH", `Le chemin sort de la racine autorisée : ${path}`);
    this.name = "UnsafePathError";
  }
}

/** Signale un fichier ou dossier attendu mais absent. */
export class FileNotFoundError extends FileSystemConnectorError {
  public constructor(path: string) {
    super("FILE_NOT_FOUND", `Chemin introuvable : ${path}`);
    this.name = "FileNotFoundError";
  }
}

/** Signale un package disque incomplet ou incohérent. */
export class InvalidFilePackageError extends FileSystemConnectorError {
  public constructor(public readonly validationErrors: readonly string[]) {
    super("INVALID_FILE_PACKAGE", validationErrors.join("; "));
    this.name = "InvalidFilePackageError";
  }
}
