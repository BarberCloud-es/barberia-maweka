diff --git a/README.md b/README.md
index f6681da6d9c1ab565515f0dcfc68d0a687086045..15a1f9accfd6eb9a7d543168afe2089991697084 100644
--- a/README.md
+++ b/README.md
@@ -1 +1,140 @@
-# barberia-maweka
\ No newline at end of file
+# barberia-maweka
+
+## Guía rápida: problema de configuración con Excel + Apps Script
+
+Si tu Web App de Apps Script no está guardando/leyendo bien las citas, revisa estos puntos (son los fallos más comunes que veo en tu script):
+
+1. **ID del spreadsheet correcto**
+   - En `getSheet(name)`, usa el `Spreadsheet ID` del archivo de Google Sheets destino.
+   - Si cambiaste de archivo, actualiza ese ID o la app seguirá escribiendo en otro documento.
+
+2. **Nombres de columnas consistentes**
+   - En tu alias canónico defines `servicio_id`, pero luego en `addAppointment` usas `colMap.svcId`.
+   - Debe ser `colMap.servicio_id`.
+
+3. **Funciones faltantes/referencias rotas**
+   - `addAppointment` llama a `getCitasPorDia(...)` y `createCalendarEvent(...)`, pero en el script compartido no aparecen implementadas.
+   - Eso rompe en tiempo de ejecución aunque el deploy sea correcto.
+
+4. **Estados normalizados**
+   - Mezclas `Confirmada`, `pendiente`, `asistio`, `eliminada`.
+   - Usa un único formato (por ejemplo todo en minúsculas): `confirmada | pendiente | asistio | eliminada`.
+
+5. **Recordatorio de cliente (trigger)**
+   - `scheduleClientReminder` usa `d.id`, pero si no lo pasas en el objeto de entrada se guarda `reminder_undefined`.
+   - Pasa explícitamente el ID recién creado.
+
+6. **Inicialización de fila por índice de cabeceras**
+   - Evita construir la fila con `for (var k in COL_ALIASES)` porque el orden del objeto puede no coincidir con columnas reales.
+   - Mejor crea un arreglo del tamaño real de columnas (`sheet.getLastColumn()`) y asigna por índice mapeado.
+
+## Parche recomendado para `addAppointment`
+
+Sustituye la función por una versión segura como esta (manteniendo tus helpers actuales):
+
+```javascript
+function addAppointment(data) {
+  var lock = LockService.getScriptLock();
+  try {
+    lock.waitLock(20000);
+
+    var sheet = getSheet(SH.CITAS);
+    var colMap = buildColMap(sheet, COL_ALIASES);
+
+    if (!data || !data.date || !data.time || !data.barber || !data.name) {
+      throw new Error("Faltan datos obligatorios de la cita.");
+    }
+
+    // Comprobar conflicto leyendo citas actuales del mismo día
+    var citas = getAppointments().filter(function (c) {
+      return c.date === data.date && c.status !== "eliminada";
+    });
+
+    var conflicto = citas.some(function (c) {
+      return c.time === data.time && c.barber === data.barber;
+    });
+
+    if (conflicto) {
+      throw new Error("Lo sentimos, este turno acaba de ser ocupado. Selecciona otro.");
+    }
+
+    var id = "RES" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMddHHmmss");
+    var row = new Array(sheet.getLastColumn()).fill("");
+
+    if (colMap.id !== undefined) row[colMap.id] = id;
+    if (colMap.nombre !== undefined) row[colMap.nombre] = data.name || "";
+    if (colMap.email !== undefined) row[colMap.email] = data.email || "";
+    if (colMap.telefono !== undefined) row[colMap.telefono] = data.phone || "";
+    if (colMap.fecha !== undefined) row[colMap.fecha] = data.date;
+    if (colMap.hora !== undefined) row[colMap.hora] = data.time;
+    if (colMap.barbero !== undefined) row[colMap.barbero] = data.barber;
+    if (colMap.servicio_id !== undefined) row[colMap.servicio_id] = data.svcId || "";
+    if (colMap.notas !== undefined) row[colMap.notas] = data.notes || "";
+    if (colMap.estado !== undefined) row[colMap.estado] = "confirmada";
+    if (colMap.creado_en !== undefined) row[colMap.creado_en] = new Date().toISOString();
+
+    sheet.appendRow(row);
+
+    // Calendario (usa la función existente real)
+    createCalendarEventWithReminder({
+      id: id,
+      name: data.name,
+      email: data.email,
+      phone: data.phone,
+      date: data.date,
+      time: data.time,
+      barber: data.barber,
+      svcId: data.svcId,
+      svcName: data.svcName,
+      duration: data.duration || 30
+    });
+
+    sendEmailCliente({
+      id: id,
+      name: data.name,
+      email: data.email,
+      phone: data.phone,
+      date: data.date,
+      time: data.time,
+      barber: data.barber,
+      svcId: data.svcId,
+      svcName: data.svcName,
+      notes: data.notes || ""
+    }, id);
+
+    sendEmailBarbero({
+      id: id,
+      name: data.name,
+      email: data.email,
+      phone: data.phone,
+      date: data.date,
+      time: data.time,
+      barber: data.barber,
+      svcId: data.svcId,
+      svcName: data.svcName,
+      notes: data.notes || ""
+    });
+
+    return { success: true, id: id };
+  } catch (e) {
+    return { success: false, msg: e.toString() };
+  } finally {
+    lock.releaseLock();
+  }
+}
+```
+
+## Pasos de despliegue limpios
+
+1. Guardar script.
+2. Ejecutar manualmente `forceAuth()` para conceder permisos.
+3. Ejecutar `setupSheets()` (solo primera vez).
+4. Ejecutar `repararTodo()`.
+5. `Implementar > Gestionar implementaciones > Editar > Nueva versión > Implementar`.
+6. Probar endpoint con:
+
+```text
+?action=getAll
+```
+
+Si responde `{ ok: true, data: ... }`, la configuración base está correcta.
