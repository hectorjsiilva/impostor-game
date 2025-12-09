# 🌐 Cómo Compartir tu Juego con Amigos

## Opción 1: Serveo (MÁS FÁCIL) ⭐

1. Abre una nueva terminal
2. Ejecuta este comando:
```bash
ssh -R 80:localhost:3000 serveo.net
```

3. Verás una URL como: `https://abc123.serveo.net`
4. ¡Comparte esa URL con tu amigo!

**IMPORTANTE:** Mantén la terminal abierta mientras juegan.

---

## Opción 2: ngrok (Más Estable)

1. Ve a https://ngrok.com y crea una cuenta GRATIS
2. Copia tu token de autenticación
3. En la terminal:
```bash
cd "/Users/hectorjanitasilva/Desktop/saas impostor"
./ngrok config add-authtoken TU_TOKEN_AQUI
./ngrok http 3000
```

4. Verás una URL como: `https://abc-123.ngrok-free.app`
5. ¡Comparte esa URL!

---

## Opción 3: localtunnel (Alternativa)

1. Instala localtunnel:
```bash
npm install -g localtunnel
```

2. Crea el túnel:
```bash
lt --port 3000
```

3. Te dará una URL como: `https://abc-123.loca.lt`

---

## 📝 Pasos Completos para Jugar:

1. **Asegúrate que el servidor esté corriendo:**
   ```bash
   cd "/Users/hectorjanitasilva/Desktop/saas impostor"
   node server.js
   ```

2. **En OTRA terminal, crea el túnel** (usa una de las opciones arriba)

3. **Comparte la URL pública** con tu amigo

4. **Crea una partida** desde el dashboard

5. **Comparte el código de la partida** (8 caracteres) con tu amigo

6. **Tu amigo puede:**
   - Ir a la URL pública que le diste
   - Registrarse/Iniciar sesión
   - Ir a "Partida Privada" 
   - Ingresar el código de 8 caracteres
   - ¡Jugar!

---

## ⚠️ Notas Importantes:

- **NO cierres las terminales** mientras juegan
- La URL pública solo funciona mientras el túnel esté activo
- Serveo es gratis pero la URL cambia cada vez
- ngrok es más estable pero requiere cuenta
- Tu computadora debe estar encendida
