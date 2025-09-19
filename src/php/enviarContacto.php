<?php
header('Content-Type: application/json');
require_once __DIR__ . '/vendor/phpmailer/PHPMailer.php';
require_once __DIR__ . '/vendor/phpmailer/SMTP.php';
require_once __DIR__ . '/vendor/phpmailer/Exception.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

// Configuración Gmail SMTP
$smtp_host = 'smtp.gmail.com';
$smtp_port = 587;
$smtp_username = 'rurairconnect@gmail.com';
$smtp_password = '.....'; // App Password de Google
$from_email = 'rurairconnect@gmail.com';
$to_email = 'rurairconnect@gmail.com';

// hCaptcha config
$hcaptcha_secret = "ES_f3c8142....";

// Función para enviar email con SMTP
function enviarEmailPHPMailer($to, $subject, $body, $reply_to = null) {
    global $smtp_host, $smtp_port, $smtp_username, $smtp_password, $from_email;

    $mail = new PHPMailer(true);

    try {
        // Activar depuración SMTP
        $mail->SMTPDebug = 2; // Nivel de detalle: 0 = nada, 2 = todo
        $mail->Debugoutput = function($str, $level) {
            error_log("PHPMailer debug [$level]: $str");
        };

        // Configuración SMTP
        $mail->isSMTP();
        $mail->Host = $smtp_host;
        $mail->SMTPAuth = true;
        $mail->Username = $smtp_username;
        $mail->Password = $smtp_password;
        $mail->SMTPSecure = 'tls';
        $mail->Port = $smtp_port;

        // Remitente y destinatario
        $mail->setFrom($from_email, 'RurAirConnect');
        $mail->addAddress($to);
        if ($reply_to) {
            $mail->addReplyTo($reply_to);
        }

        // Contenido
        $mail->isHTML(true);
        $mail->Subject = $subject;
        $mail->Body = $body;

        $mail->send();
        return true;
    } catch (Exception $e) {
        error_log("PHPMailer error: " . $mail->ErrorInfo);
        return false;
    }
}

try {
    // Sanitizar datos
    $nombre = htmlspecialchars(trim($_POST["nombre"] ?? ''));
    $apellidos = htmlspecialchars(trim($_POST["apellidos"] ?? ''));
    $correo = filter_var(trim($_POST["email"] ?? ''), FILTER_SANITIZE_EMAIL);
    $mensaje = htmlspecialchars(trim($_POST["mensaje"] ?? ''));
    $captcha = $_POST['h-captcha-response'] ?? '';

    // Validaciones básicas
    if (!$nombre || !$apellidos || !$correo || !$mensaje) {
        http_response_code(400);
        echo json_encode([
            "success" => false, 
            "message" => "Todos los campos son obligatorios."
        ]);
        exit;
    }

    if (!filter_var($correo, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode([
            "success" => false, 
            "message" => "Correo electrónico inválido."
        ]);
        exit;
    }

    // Validar hCaptcha
    if (!$captcha) {
        http_response_code(400);
        echo json_encode([
            "success" => false, 
            "message" => "Por favor completa el CAPTCHA."
        ]);
        exit;
    }

    // Verificar hCaptcha
    $verify_response = file_get_contents("https://hcaptcha.com/siteverify", false, stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => "Content-type: application/x-www-form-urlencoded",
            'content' => http_build_query([
                'response' => $captcha,
                'secret' => $hcaptcha_secret
            ])
        ]
    ]));

    $captcha_result = json_decode($verify_response);
    if (!$captcha_result || !$captcha_result->success) {
        http_response_code(400);
        echo json_encode([
            "success" => false, 
            "message" => "CAPTCHA inválido."
        ]);
        exit;
    }

    // Email al administrador
    $admin_subject = 'Nuevo mensaje de contacto - RurAirConnect';
    $admin_body = "
        <html>
        <body style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>
            <h2 style='color: #2c5530;'>Nuevo mensaje de contacto</h2>
            <div style='background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;'>
                <p><strong>Nombre:</strong> {$nombre} {$apellidos}</p>
                <p><strong>Correo:</strong> {$correo}</p>
                <p><strong>Fecha:</strong> " . date('d/m/Y H:i:s') . "</p>
            </div>
            <div style='background: #fff; padding: 20px; border-left: 4px solid #2c5530;'>
                <h3>Mensaje:</h3>
                <p>" . nl2br($mensaje) . "</p>
            </div>
            <hr style='margin: 30px 0;'>
            <p style='color: #666; font-size: 12px;'>
                Enviado desde el formulario de contacto de RurAirConnect
            </p>
        </body>
        </html>
    ";

    // Email de confirmación al usuario
    $user_subject = 'Confirmación de mensaje - RurAirConnect';
    $user_body = "
        <html>
        <body style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>
            <h2 style='color: #2c5530;'>¡Gracias por contactarnos!</h2>
            <p>Hola <strong>{$nombre}</strong>,</p>
            <p>Hemos recibido tu mensaje y te responderemos lo antes posible.</p>
            
            <div style='background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;'>
                <h3 style='color: #2c5530;'>Resumen de tu mensaje:</h3>
                <p><strong>Nombre:</strong> {$nombre} {$apellidos}</p>
                <p><strong>Correo:</strong> {$correo}</p>
                <p><strong>Fecha:</strong> " . date('d/m/Y H:i:s') . "</p>
            </div>
            
            <div style='background: #fff; padding: 20px; border-left: 4px solid #2c5530;'>
                <h4>Tu mensaje:</h4>
                <p>" . nl2br($mensaje) . "</p>
            </div>
            
            <div style='background: #e8f5e8; padding: 15px; border-radius: 8px; margin: 20px 0;'>
                <p style='margin: 0;'>
                    <strong>Tiempo de respuesta estimado:</strong> 24-48 horas
                </p>
            </div>
            
            <hr style='margin: 30px 0;'>
            <p style='color: #2c5530;'>
                Saludos,<br>
                <strong>Equipo RurAirConnect</strong>
            </p>
            <p style='color: #666; font-size: 12px;'>
                Este es un mensaje automático, no responder a este email.
            </p>
        </body>
        </html>
    ";

    // Enviar emails
    $admin_sent = enviarEmailPHPMailer($to_email, $admin_subject, $admin_body, $correo);
    $user_sent = enviarEmailPHPMailer($correo, $user_subject, $user_body);

    if ($admin_sent) {
        echo json_encode([
            "success" => true, 
            "message" => $user_sent ? 
                "Mensaje enviado correctamente. Recibirás una confirmación por email." :
                "Mensaje enviado correctamente."
        ]);
    } else {
        http_response_code(500);
        echo json_encode([
            "success" => false, 
            "message" => "Error al enviar el mensaje. Inténtalo más tarde."
        ]);
    }

} catch (Exception $e) {
    error_log("Error en contacto: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false, 
        "message" => "Error interno del servidor."
    ]);
}
