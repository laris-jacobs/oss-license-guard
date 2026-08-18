# OSS License Guard – Produktspezifikation

Status: Entwurf zur gemeinsamen Abstimmung  
Arbeitstitel: `oss-license-guard`  
Ziel der ersten Version: Ersatz für `@bbc/apache2-license-checker` und den separaten Aufruf von `license-checker` in npm-, pnpm- und Yarn-Projekten

## 1. Vision

`oss-license-guard` ist ein Open-Source-CLI, das die Lizenzen aller tatsächlich aufgelösten Abhängigkeiten eines Projekts prüft und eine reproduzierbare Third-Party-Lizenzdatei erzeugt.

Ein Projekt gibt seine eigene Lizenz als SPDX-Ausdruck an. Das Tool bewertet die Lizenzen seiner Abhängigkeiten anhand einer versionierten Kompatibilitätsmatrix. Bewusste Ausnahmen werden explizit und nachvollziehbar konfiguriert; eine Begründung wird empfohlen, bleibt aber optional. Nicht kompatible, unbekannte oder nicht eindeutig bestimmbare Lizenzen führen im Prüfmodus zu einem fehlgeschlagenen Build.

Die Apache-2.0-Lizenz von `oss-license-guard` selbst ist vollständig von der Lizenz des geprüften Projekts getrennt. Ein nutzendes Projekt kann beispielsweise MIT, MPL-2.0, Apache-2.0 oder einen anderen gültigen SPDX-Ausdruck als `project.license` wählen. Die Matrix wird anhand dieser gewählten Projektlizenz ausgewertet und ist nicht auf Apache-2.0-Projekte beschränkt.

Das Tool liefert technische Unterstützung und Nachvollziehbarkeit, aber keine Rechtsberatung. Dieser Hinweis muss in Dokumentation und generierten Reports erscheinen können.

## 2. Ziele

- Ein einziger Befehl prüft Lizenzrichtlinien und erzeugt beziehungsweise verifiziert den Third-Party-Report.
- Die Projektlizenz und alle erkannten Lizenzen verwenden SPDX-Identifier beziehungsweise SPDX-Ausdrücke.
- Eine mitgelieferte, versionierte Matrix enthält sinnvolle Standardregeln für verbreitete Projektlizenzen.
- Organisationen und Projekte können die Matrix ergänzen oder gezielt überschreiben.
- Ausnahmen sind präzise konfigurierbar und im Review sichtbar; Begründung und Ablaufdatum sind optional.
- Package-Muster unterstützen alle Versionen, SemVer-Bereiche und exakte Versionen.
- Lokale Entwicklung und CI liefern dasselbe, deterministische Ergebnis.
- Das CLI lässt sich ohne globale Installation über ein `devDependency` und npm scripts verwenden.

## 3. Nicht-Ziele des MVP

- Keine verbindliche juristische Bewertung oder automatische Einzelfallfreigabe.
- Keine Schwachstellen-, Exportkontroll- oder Copyright-Compliance-Prüfung.
- Keine automatische Änderung oder Veröffentlichung fremder Packages.
- Keine automatische Git-Commit-/Push-Funktion.
- Kein Scannen beliebiger Quelltexte nach kopierten Codefragmenten.
- Im MVP keine Maven-, Gradle-, Python-, Go- oder Rust-Unterstützung. Die Kernlogik wird jedoch von npm-, pnpm- und Yarn-spezifischen Adaptern getrennt.

## 4. Zielgruppe und typische Abläufe

### Entwickler lokal

1. Fügt `oss-license-guard` als `devDependency` hinzu.
2. Legt eine Konfiguration an oder führt `oss-license-guard init` aus.
3. Führt `oss-license-guard check` aus.
4. Ergänzt bei einem bewussten Sonderfall eine eng begrenzte Exemption und kann optional eine Begründung dokumentieren.
5. Erzeugt mit `oss-license-guard generate` den Report.

### CI/CD

`oss-license-guard verify` prüft Policy und Report in einem read-only Ablauf. Der Befehl beendet sich mit Exit-Code ungleich null, wenn eine Policy-Verletzung besteht, der Report fehlt oder nicht dem aktuell erzeugbaren Inhalt entspricht.

Empfohlene Einbindung:

```json
{
  "scripts": {
    "licenses:generate": "oss-license-guard generate",
    "licenses:check": "oss-license-guard verify",
    "build": "npm run licenses:check && <existing-build-command>"
  }
}
```

## 5. Konfiguration

### 5.1 Datei und Auflösung

- Standarddatei: `license-guard.config.yaml` im Projekt-Root.
- Alternativ über `--config <path>`.
- Unterstützt werden YAML, JSON und ein dokumentierter Konfigurationsabschnitt in `package.json`.
- YAML ist das primäre und empfohlene Format, weil Kommentare ein Kernbestandteil der Anforderungen sind.
- Ohne expliziten `--config`-Pfad gilt eine dokumentierte Suchreihenfolge; mehrere gleichzeitig gefundene Konfigurationen führen zu einem verständlichen Fehler statt zu einer stillen Auswahl.
- Relative Pfade werden relativ zur Konfigurationsdatei aufgelöst.
- CLI-Argumente dürfen klar definierte skalare Werte überschreiben, aber keine versteckten Policy-Ausnahmen erzeugen.
- Für Editor-Unterstützung wird ein versioniertes JSON Schema veröffentlicht.

### 5.2 Beispiel

```yaml
schemaVersion: 1

project:
  license: MPL-2.0          # Lizenz des geprüften Projekts, frei wählbar

dependencies:
  include: all              # production | development | all; Default: all
  packageManager: auto      # auto | npm | pnpm | yarn
  includePeer: true         # separat konfigurierbar; Default: true
  includeOptional: true     # separat konfigurierbar; Default: true

policy:
  preset: oss-distribution
  matrix:
    sources:
      - builtin
      # Remote Quellen sind explizit versioniert und mit einem Digest fixiert.
      # - url: https://example.org/company-license-policy/v1.yaml
      #   sha256: "<required-sha256>"
    additions:
      MPL-2.0:
        - BSD-4-Clause
    removals:
      MPL-2.0:
        - Artistic-1.0
  unknownLicense: deny
  unlicensedPackage: deny
  ambiguousExpression: deny

exemptions:
  - package: "legacy-widget"
    versions: "*"
    reason: "Freigabe Legal #LEGAL-1234; Austausch ist geplant." # optional
    approvedBy: "Open Source Office"
    expires: 2027-03-31
  - package: "@vendor/codec"
    versions: "^3.0.0"
    licenses:
      - GPL-3.0-only
    reason: "Nur serverseitige Nutzung gemäß dokumentierter Freigabe."
  - package: "problematic-lib"
    versions: "2.4.1"
    reason: "Exakte Version geprüft."

report:
  path: ../THIRD-PARTY-FRONTEND-LICENSES.md
  format: markdown          # markdown | json
  template: ./license-report.hbs
  includeLicenseText: true
  includeDevDependencies: false
  title: Third-Party Licenses
  sortBy: name
  includeExemptions: true   # konfigurierbar; Default: true
```

## 6. Lizenzmodell und Kompatibilitätsmatrix

### 6.1 SPDX als gemeinsame Sprache

- Projekt- und Dependency-Lizenzen werden als SPDX 3.x-Identifier oder SPDX-Ausdrücke verarbeitet.
- Veraltete beziehungsweise häufige nicht standardisierte Bezeichnungen können über eine dokumentierte Alias-Liste normalisiert werden.
- Eine Normalisierung darf niemals eine unsichere Zuordnung stillschweigend vornehmen.
- `LicenseRef-*` bleibt möglich, gilt ohne explizite Regel oder Exemption jedoch als nicht erlaubt.

### 6.2 Semantik der Matrix

Die Matrix beantwortet: „Darf eine Dependency mit Lizenz X in einem Projekt mit Lizenz Y gemäß der gewählten organisatorischen Policy verwendet und verteilt werden?“ Sie behauptet keine allgemeingültige juristische Wahrheit. Der Nutzungskontext wird über die eingebauten Profile `oss-distribution` für veröffentlichte OSS-Artefakte und `internal-application` für interne Anwendungen/SaaS abgebildet. Das interne Profil darf dokumentiert zusätzliche Lizenzen, insbesondere bestimmte Copyleft-Lizenzen, erlauben; die konkrete Baseline wird einzeln nachvollziehbar gepflegt.

- Die Auswahl startet bei `project.license`.
- Die Matrix ist nach Projektlizenz und Nutzungskontext aufgebaut. Für jede unterstützte Projektlizenz existiert eine eigene Menge kompatibler Dependency-Lizenzen; es gibt keine fest verdrahtete Apache-2.0-Annahme.
- Regeln sind versioniert und haben eine dokumentierte Herkunft. Das Projekt pflegt eine konservative, öffentlich dokumentierte Baseline; eine externe juristische Freigabe ist nicht Voraussetzung für deren Veröffentlichung.
- Lokale `additions` erweitern, `removals` verschärfen die effektive Policy.
- Konflikte werden deterministisch aufgelöst: lokale Verbote gewinnen vor lokalen Freigaben; explizite lokale Regeln gewinnen vor Remote- und Built-in-Regeln.
- Das CLI kann mit `oss-license-guard policy explain <license-expression>` erklären, welche Regel zur Entscheidung geführt hat.
- Die effektive Policy inklusive Quellen, Versionen und Digests erscheint in maschinenlesbarer Ausgabe.

Die erste konservative Baseline berücksichtigt für `oss-distribution` die Dependency-Lizenzen `0BSD`, `Apache-2.0`, `BSD-2-Clause`, `BSD-3-Clause`, `ISC`, `MIT` und `Unlicense`. Eine Lizenz wird daraus nicht pauschal für jedes Projekt erlaubt, sondern nur in den Matrixzeilen der Projektlizenzen, mit denen sie gemäß der dokumentierten Policy kompatibel ist.

`internal-application` kann zusätzlich `MPL-2.0` sowie `LGPL-2.1-only`, `LGPL-2.1-or-later`, `LGPL-3.0-only` und `LGPL-3.0-or-later` erlauben. GPL wird nicht pauschal in dieses Profil aufgenommen. AGPL-Varianten werden in allen eingebauten Profilen blockiert und sind nur über eine explizite Exemption zulässig.

### 6.3 Online-Policies

Remote-Policies sind optional und standardmäßig deaktiviert. Für reproduzierbare und sichere Builds gilt:

- Eine URL muss mit Version und SHA-256-Digest fixiert werden.
- Redirects, maximale Größe und Timeout werden begrenzt.
- Ohne passenden Digest wird die Datei verworfen.
- Ein Cache darf verwendet werden; `--offline` verbietet Netzwerkzugriffe.
- CI soll bevorzugt eine eingecheckte oder als Package veröffentlichte Policy verwenden.
- Remote-Inhalte dürfen keine Skripte oder Templates ausführen.

### 6.4 Mehrfach- und Dual-Lizenzen

- `MIT OR Apache-2.0`: erlaubt, wenn mindestens eine Alternative erlaubt ist.
- `MIT AND BSD-3-Clause`: erlaubt, wenn alle Bestandteile erlaubt sind.
- Klammern werden gemäß SPDX-Ausdruck ausgewertet.
- Nicht parsebare oder mehrdeutige Angaben werden gemäß `ambiguousExpression` behandelt, standardmäßig `deny`.
- Die gewählte Alternative und die Begründung erscheinen im Prüfresultat.

## 7. Ermittlung der Abhängigkeiten und Lizenzen

### 7.1 Dependency-Quelle

- Der MVP unterstützt npm, pnpm und Yarn mit ihren jeweiligen Lockfiles und respektiert den vollständig aufgelösten Dependency-Graphen inklusive transitiver Dependencies.
- Der Lockfile ist die maßgebliche Quelle für Name und exakte Version.
- Ein vollständig installiertes Projekt beziehungsweise ein passendes `node_modules` ist im MVP erforderlich. Lizenzmetadaten und Lizenztexte werden lokal daraus gelesen; ein Registry-only-Modus ist nicht Bestandteil des MVP.
- Fehlt ein Lockfile oder passt es nicht zum Manifest, schlägt `verify` standardmäßig fehl. Dieses Verhalten ist konfigurierbar.
- Workspaces/Monorepos werden im MVP unterstützt. Sie können wahlweise einen gemeinsamen Report oder einen Report pro Workspace erzeugen.
- `production`, `development` oder `all` bestimmt den Scope. Standardmäßig werden alle Dependencies einschließlich `devDependencies` geprüft.
- Peer- und optionale Dependencies sind separat konfigurierbar und werden standardmäßig mitgeprüft.
- Unterstützt werden Yarn Classic 1.x und moderne Yarn-/Berry-Versionen.
- Das Tool selbst und rein lokale Workspace-Pakete können konfigurierbar aus dem Third-Party-Report ausgeschlossen werden.

### 7.2 Evidenz und Priorität

Lizenzinformationen werden mit Herkunft erfasst. Vorgeschlagene Priorität:

1. SPDX-Ausdruck im installierten `package.json`.
2. eindeutig referenzierte Lizenzdatei des installierten Packages.
3. Registry-Metadaten nur als optionaler Fallback.

Widersprechen sich Quellen, wird der Konflikt sichtbar ausgegeben und standardmäßig abgelehnt. Dateinamen allein (`LICENSE`, `COPYING`) sind kein ausreichender Lizenznachweis; eine Texterkennung muss Konfidenz und Quelle ausweisen.

## 8. Exemptions

Exemptions genehmigen ein konkretes Package in einem definierten Versionsbereich trotz Policy-Verletzung. Sie verändern nicht die allgemeine Kompatibilitätsmatrix.

### 8.1 Matching

- Package-Name unterstützt minimatch-artige Globs, einschließlich Scopes: `@vendor/*`.
- `versions: "*"` gilt für alle Versionen.
- SemVer-Ranges unterstützen unter anderem `^3.0.0`, `>=2 <3` und `3.x`.
- Eine exakte Version wie `2.4.1` gilt nur für diese Version.
- Optional begrenzt `licenses` die Ausnahme zusätzlich auf konkrete SPDX-Ausdrücke.
- Eine Exemption greift nur, wenn Name, Version und – sofern angegeben – Lizenz zusammenpassen.

### 8.2 Governance

- Nur `package` ist grundsätzlich verpflichtend; Kommentar/`reason`, `approvedBy`, Ticket/URL und `expires` sind optional.
- Fehlt `reason`, bleibt die Exemption gültig, das CLI gibt jedoch standardmäßig eine Warnung aus.
- Ein Package-Wildcard wie `@vendor/*` muss zusätzlich durch `versions` oder `licenses` eingeschränkt werden. Eine exakte Package-Angabe darf ohne Versionsangabe für alle Versionen gelten.
- Wenn `expires` gesetzt ist, führen abgelaufene Exemptions zu einem Fehler.
- Noch nicht verwendete beziehungsweise veraltete Exemptions erzeugen standardmäßig eine Warnung; `strictUnusedExemptions` macht sie zu einem Fehler.
- Jede genutzte Exemption erscheint im Konsolen- und JSON-Prüfresultat. Die Aufnahme in den Third-Party-Report ist konfigurierbar und standardmäßig aktiviert.
- Breite Muster wie `package: "*"` plus `versions: "*"` werden standardmäßig abgelehnt oder benötigen einen expliziten Unsafe-Schalter.
- Secrets oder vertrauliche Rechtsgutachten gehören nicht in `reason`; stattdessen soll auf eine interne Referenz verwiesen werden.

## 9. Third-Party-Report

### 9.1 Inhalt

Für jede eindeutige Kombination aus Package und Version enthält der Report mindestens:

- Name und exakte Version
- erkannter SPDX-Ausdruck und gegebenenfalls gewählte Alternative
- Package-/Repository-URL, sofern vorhanden
- Copyright-Hinweise, sofern zuverlässig verfügbar
- standardmäßig der vollständige Lizenztext; ein Report-Stil kann zusätzlich Link und Quelle darstellen
- Status und Begründung einer angewendeten Exemption
- Herkunft der Lizenzinformation

### 9.2 Ausgabe und Styling

- Zielpfad ist frei konfigurierbar; fehlende Elternverzeichnisse werden in `generate` angelegt.
- Eingebaute Formate im MVP: Markdown und JSON.
- Ein benutzerdefiniertes, dateibasiertes Template erlaubt eigenes Styling; vorgeschlagen ist eine eingeschränkte Handlebars-kompatible Syntax ohne Codeausführung.
- Header, Footer, Titel, Spalten, Sortierung und Gruppierung sind konfigurierbar.
- Markdown ist der Default. Vollständige Lizenztexte sind standardmäßig enthalten; der gewählte beziehungsweise konfigurierte Report-Stil kann Inhalt und Darstellung anpassen.
- Ausgabe ist deterministisch: stabile Sortierung, einheitliche Zeilenenden, keine Zeitstempel ohne explizite Option und atomisches Schreiben.
- Mehrfach vorkommende identische Package-Versionen werden dedupliziert.
- Unterschiedliche Versionen desselben Packages bleiben getrennte Einträge.
- Fehlende Lizenztexte sind sichtbar und gemäß Policy als Warnung oder Fehler konfigurierbar.
- Ist ein gültiger SPDX-Identifier vorhanden, erzeugt ein fehlender vollständiger Lizenztext standardmäßig eine Warnung. Ohne gültigen SPDX-Identifier bleibt das strengere Verhalten für unbekannte beziehungsweise unlizenzierte Packages bestehen.

### 9.3 Generate versus Verify

- `generate` schreibt beziehungsweise aktualisiert den konfigurierten Report.
- `verify` schreibt keine Projektdateien. Es erzeugt den erwarteten Inhalt intern und vergleicht ihn bytegenau oder normalisiert gemäß dokumentierter Regeln.
- Ein fehlender oder veralteter Report lässt `verify` fehlschlagen und zeigt einen verständlichen Diff beziehungsweise die nötige Aktion.
- `check` prüft die Lizenz-Policy, ohne den Report zwingend zu prüfen.

## 10. CLI-Vertrag

```text
oss-license-guard init
oss-license-guard check [--config <path>] [--json] [--offline]
oss-license-guard generate [--config <path>] [--out <path>] [--format <format>]
oss-license-guard verify [--config <path>] [--json] [--offline]
oss-license-guard policy explain <spdx-expression> [--config <path>]
oss-license-guard config validate [--config <path>]
```

- Keine Argumente: vorgeschlagenes Verhalten ist `verify`, damit der CI-sichere Modus der Default ist.
- Menschenlesbare Ausgabe geht nach stderr/stdout gemäß üblicher CLI-Konvention; `--json` liefert ein stabiles, versioniertes Schema.
- `--quiet`, `--verbose`, `--no-color` und Erkennung von `NO_COLOR` werden unterstützt.
- Zugangsdaten und URLs mit Credentials werden in Logs redigiert.
- Es werden keine Aliase und keine Argumentkompatibilität für `apache2-license-checker` angeboten. Die Migration erfolgt explizit auf die neuen Befehle.

### Exit-Codes

| Code | Bedeutung |
|---:|---|
| 0 | Policy und gegebenenfalls Report sind gültig |
| 1 | Policy-Verletzung, abgelaufene Exemption oder veralteter Report |
| 2 | Ungültige Konfiguration oder CLI-Nutzung |
| 3 | Technischer Fehler, zum Beispiel Lockfile nicht lesbar oder Remote-Policy nicht verfügbar |

Die genaue Exit-Code-Liste ist Teil der stabilen öffentlichen API und wird vor 1.0 finalisiert.

## 11. Entscheidungslogik

Für jede aufgelöste Package-Version:

1. Lizenz-Evidenz sammeln und normalisieren.
2. SPDX-Ausdruck parsen.
3. Gegen die effektive Matrix für die Projektlizenz prüfen.
4. Bei Erfolg den Eintrag als `allowed` markieren.
5. Bei Misserfolg nach einer exakt passenden, nicht abgelaufenen Exemption suchen.
6. Bei passender Exemption als `exempted` markieren und Begründung melden.
7. Sonst als `denied`, `unknown`, `unlicensed` oder `ambiguous` melden.
8. Sobald mindestens ein blockierender Eintrag besteht, endet `check`/`verify` mit Exit-Code 1; alle Befunde werden dennoch gesammelt und ausgegeben.

## 12. Sicherheits- und Qualitätsanforderungen

- Keine Ausführung von Code aus Dependencies, Policy-Dateien oder Report-Templates.
- Abhängigkeitsanalyse muss auch mit nicht vertrauenswürdigen Package-Metadaten sicher umgehen.
- Schutz gegen Path Traversal bei Lizenzdateien und Report-Ausgabe.
- Atomische Schreibvorgänge; bei Fehler bleibt die bestehende Reportdatei erhalten.
- Keine Telemetrie im Default; spätere Telemetrie ausschließlich opt-in.
- Reproduzierbare npm-Veröffentlichung mit Provenance und signierten Releases, soweit Plattformen dies erlauben.
- Eigene Dependencies möglichst klein halten und ebenfalls mit dem Tool prüfen (Dogfooding).
- Unterstützt und in CI getestet werden die zum jeweiligen Releasezeitpunkt von Node.js unterstützten geraden LTS-Versionen. Das konkrete Supportfenster jedes Tool-Releases wird dokumentiert.
- Unit-, Integrations-, CLI-Snapshot- und End-to-End-Tests auf Linux, macOS und Windows.
- Tests decken SPDX-`AND`/`OR`, Scopes, Globs, SemVer, Lockfile-Versionen, Workspaces, zyklische Graphen, doppelte Packages und manipulierte Eingaben ab.

## 13. Datenschutz und Netzwerkverhalten

- Standardbetrieb arbeitet ausschließlich mit lokalen Manifesten, Lockfiles und installierten Package-Metadaten.
- Netzwerkzugriffe erfolgen nur für explizit konfigurierte Remote-Policies oder Registry-Fallbacks.
- Das Tool sendet keine Dependency-Liste an einen zentralen Dienst.
- Alle Netzwerkzugriffe sind dokumentiert, abschaltbar und haben Timeouts.

## 14. OSS-Projektanforderungen

Vor der ersten öffentlichen Veröffentlichung enthält das Repository mindestens:

- `README.md` mit Quickstart, Konfigurationsbeispiel und Migrationsanleitung
- eigene `LICENSE` (Vorschlag: Apache-2.0)
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` und `SECURITY.md`
- Changelog und semantische Versionierung
- Issue- und Pull-Request-Templates
- automatisierte Tests, Linting, Formatierung und Release-Workflow
- dokumentiertes Supportfenster für Node-Versionen
- maschinenlesbares Konfigurations- und JSON-Ausgabeschema
- dokumentierte Herkunft und Review-Prozess der eingebauten Lizenzmatrix
- klaren Disclaimer, dass die Matrix eine Policy und keine Rechtsberatung darstellt

Das Vorhaben wird als öffentliches OSS-Projekt unter dem persönlichen Account des Maintainers gestartet. Eine Organisation besteht derzeit nicht. Der endgültige npm-Package-Name, ein möglicher Scope und die Registry-Verfügbarkeit werden vor der ersten Veröffentlichung festgelegt; dies blockiert die lokale Implementierung nicht.

## 15. Abnahmekriterien für MVP

1. Ein Apache-2.0-lizenziertes npm-, pnpm- oder Yarn-Projekt kann standardmäßig alle Dependencies anhand einer eingebauten Matrix prüfen.
2. Eine neue inkompatible, unbekannte oder unlizenzierte transitive Dependency lässt `check` und `verify` mit Exit-Code 1 fehlschlagen.
3. Eine passende Exemption für `name + optional SemVer-Range + optional license` erlaubt genau den konfigurierten Bereich; ein vorhandener Grund wird ausgegeben.
4. Glob-Muster funktionieren für unscoped und scoped Package-Namen.
5. Eine mit Ablaufdatum versehene, abgelaufene Exemption schlägt fehl; eine unbenutzte Exemption erzeugt standardmäßig eine Warnung.
6. `generate` erzeugt einen stabil sortierten Markdown-Report am konfigurierten Pfad.
7. Ein frei konfiguriertes Template verändert den Report, ohne Code auszuführen.
8. `verify` erkennt einen fehlenden oder veralteten Report, verändert aber keine Datei.
9. SPDX-Ausdrücke mit `AND`, `OR` und Klammern werden korrekt und erklärbar ausgewertet.
10. Eine lokale Matrix-Erweiterung kann eine zusätzliche Lizenz erlauben; ein lokales Removal kann eine Built-in-Freigabe verbieten.
11. Eine gepinnte Remote-Policy wird nur bei passendem Digest akzeptiert; `--offline` verursacht keinen Netzwerkzugriff.
12. JSON-Ausgabe enthält Package, Version, erkannte Lizenz, Evidenz, Entscheidung, Regelquelle und gegebenenfalls Exemption.
13. Das CLI läuft in den dokumentierten Node-LTS-Versionen unter Linux, macOS und Windows.
14. Eine Beispielmigration ersetzt beide bisherigen npm scripts für `apache2-license-checker` und `license-checker` durch das neue Tool.

## 16. Vorgeschlagene technische Richtung

Diese Punkte sind noch keine zwingenden Produktanforderungen:

- TypeScript und Node.js als Implementierung, veröffentlicht als npm-Package mit CLI-Binary.
- Module: `dependency-adapter`, `license-evidence`, `spdx-policy-engine`, `exemption-engine`, `report-renderer`, `cli`.
- Separate Lockfile-Adapter für npm, pnpm und Yarn im MVP.
- JSON Schema plus TypeScript-Typen als versionierter Konfigurationsvertrag.
- Eine eingebettete Built-in-Policy statt einer bei jedem Build online geladenen Matrix.

## 17. Getroffene Produktentscheidungen

1. **Scope:** npm, pnpm und Yarn werden direkt im ersten Release unterstützt.
2. **Dependency-Auswahl:** Standardmäßig werden alle Dependencies einschließlich Development-Dependencies geprüft.
3. **Nutzungskontext:** Veröffentlichte OSS-Artefakte und interne Anwendungen/SaaS werden über auswählbare Policy-Profile unterstützt.
4. **Matrix:** Das Tool enthält eine konservative, öffentlich dokumentierte Baseline und unterstützt lokale Ergänzungen sowie versionierte, per Digest fixierte Online-Policies.
5. **Verantwortung:** Die initiale Baseline wird vom Projekt selbst öffentlich nachvollziehbar gepflegt.
6. **Exemptions:** Nur das Package ist grundsätzlich verpflichtend; Kommentar und Governance-Metadaten bleiben optional.
7. **Matching:** Vollständige SemVer-Ranges werden unterstützt. Package-Wildcards müssen zusätzlich durch Version oder Lizenz eingegrenzt werden.
8. **Ungenutzte Exemptions:** Standardmäßig Warnung, optional als Fehler konfigurierbar.
9. **Reportinhalt:** Der gewählte Report-Stil bestimmt Felder und Umfang.
10. **Formate:** Markdown und JSON gehören zum MVP.
11. **Styling:** Eingebaute Defaults und sichere eigene Templates gehören zum MVP.
12. **CI:** `verify` verändert keine Dateien und bricht bei fehlendem oder veraltetem Report mit einem Diff ab.
13. **Monorepos:** Gemeinsamer Report und Report pro Workspace sind konfigurierbar.
14. **Lockfile:** Verhalten ohne gültiges Lockfile ist konfigurierbar; Default ist Build-Abbruch.
15. **Baseline-Modus:** Es gibt keinen Modus, der bestehende Verstöße pauschal akzeptiert.
16. **Name:** Das Projekt und npm-Package sollen `oss-license-guard` heißen, vorbehaltlich Registry-Verfügbarkeit.
17. **Projektlizenz:** Apache-2.0.
18. **Peer-/optionale Dependencies:** Separat konfigurierbar und standardmäßig eingeschlossen.
19. **Yarn:** Yarn Classic und Yarn Berry werden unterstützt.
20. **Migration:** Keine CLI-Kompatibilitätsaliase zum bisherigen `apache2-license-checker`.
21. **Policy-Profile:** Eingebaut werden `oss-distribution` und `internal-application`.
22. **Fehlende Exemption-Begründung:** Zulässig, erzeugt aber standardmäßig eine Warnung.
23. **Exemptions im Report:** Konfigurierbar und standardmäßig sichtbar.
24. **Node.js:** Unterstützt werden die jeweils offiziell unterstützten geraden LTS-Versionen.
25. **Konfigurationsformate:** YAML, JSON und ein Abschnitt in `package.json`; YAML ist die Empfehlung.
26. **Installationszustand:** Der MVP benötigt lokale `node_modules` und liest Lizenztexte daraus.
27. **Profilunterschied:** `internal-application` darf gegenüber `oss-distribution` dokumentiert zusätzliche, insbesondere bestimmte Copyleft-Lizenzen erlauben.
28. **Lizenztexte:** Vollständige Lizenztexte sind im Report standardmäßig enthalten.
29. **Veröffentlichung:** Persönliches öffentliches OSS-Projekt; npm-Name und Scope bleiben bis zur Veröffentlichung offen.
30. **Trennung der Lizenzen:** Apache-2.0 lizenziert ausschließlich `oss-license-guard`; die Lizenz eines geprüften Projekts ist frei als SPDX-Ausdruck wählbar und steuert die passende Matrixzeile.
31. **OSS-Baseline:** Berücksichtigt werden zunächst 0BSD, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, MIT und Unlicense, jeweils abhängig von der gewählten Projektlizenz.
32. **Internes Profil:** Ergänzt MPL-2.0 und LGPL-2.1/3.0; GPL wird nicht pauschal freigegeben.
33. **AGPL:** In eingebauten Profilen immer blockiert und nur per Exemption zulässig.
34. **Fehlender Lizenztext:** Bei gültigem SPDX-Identifier standardmäßig Warnung statt Build-Abbruch.

## 18. Sinnvolle Erweiterungen nach dem MVP

- Maven-, Gradle-, Python-, Go- und Cargo-Adapter
- CycloneDX/SPDX-SBOM-Import und -Export
- SARIF-Ausgabe und GitHub Code Scanning Annotationen
- Organisationsweite Policy als signiertes npm-/OCI-Artefakt
- HTML-Report und mehrere parallele Ausgabeformate
- Pull-Request-Kommentar mit Policy-Diff
- `exemptions lint` zur Erkennung überbreiter, ablaufender und ungenutzter Ausnahmen
- Programmatic API neben dem CLI
