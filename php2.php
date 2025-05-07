<?php
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

header('Content-Type: application/json');
error_reporting(E_ALL);
ini_set('display_errors', 1);

try {
    require 'vendor/autoload.php';

    // Get and validate input data
    $json = file_get_contents('php://input');
    $data = json_decode($json, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception('Invalid JSON data');
    }
    
    if (empty($data['select']) || empty($data['message'])) {
        throw new Exception('Missing required fields');
    }

    // Email configuration
    $defaultMail = "int@scadaint.ru";
    $email_addresses = array(
        'Техническая поддержка' => 'support@scadaint.ru',
        'Запрос документации' => 'commerce@scadaint.ru',
        'Запрос пробной версии' => 'commerce@scadaint.ru',
        'Запрос ценового предложения' => 'commerce@scadaint.ru',
        'Запрос на обучение' => 'commerce@scadaint.ru' 
    );

    // Setup PHPMailer
    $mail = new PHPMailer(true);
    $mail->isHTML(true);
    $mail->CharSet = "UTF-8";
    $mail->isSMTP();
    $mail->SMTPAuth = false;
    $mail->Host = "smtp.elesy.ru";
    $mail->Port = 25;
    $mail->Username = "";
    $mail->Password = "";
    $mail->setFrom('noreply.scadaint@scadaint.ru', 'scadaint.ru');

    // Set recipient
    if(!empty($data['select']) && isset($email_addresses[$data['select']])) {
        $defaultMail = $email_addresses[$data['select']];
    }
    $mail->addAddress($defaultMail);

    // Prepare email body
    $body = "<h1>Письмо отправлено с сайта scadaint.ru</h1>";
    if(!empty($data['message'])) {
        $body .= '<p><strong>Сообщение: </strong>' . htmlspecialchars($data['message']) . '</p>';
    }
    $mail->Body = $body;

    // Send email
    $mail->send();
    
    // Return success response
    echo json_encode([
        'success' => true,
        'message' => 'Email sent successfully'
    ]);

} catch (Exception $e) {
    // Return error response
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
?>