# Queue

`JobQueue` est une file prioritaire stable. Elle classe `CRITICAL`, `HIGH`, `NORMAL`, `LOW`, puis conserve l'ordre de création. Elle peut être suspendue et restaurée depuis un snapshot injecté.

`JsonJobPersistence` écrit atomiquement un snapshot temporaire puis le renomme. `MemoryJobPersistence` sert aux tests et au mode Mock.
