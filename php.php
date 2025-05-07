<?php
use PHPMailer\PHPMailer\PHPMailer;
require 'vendor/autoload.php';
$json = file_get_contents('php://input');
$data = json_decode($json, true);

$defaultMail = "int@scadaint.ru";
$email_addresses = array(
    'Техническая поддержка' => 'support@scadaint.ru',
    'Запрос документации' => 'commerce@scadaint.ru',
    'Запрос пробной версии' => 'commerce@scadaint.ru',
    'Запрос ценового предложения' => 'commerce@scadaint.ru',
    'Запрос на обучение' => 'commerce@scadaint.ru' 
);

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
$mail->addAddress($defaultMail);

$body = "<h1>Письмо отправлено с сайта scadaint.ru</h1>";

if(!empty($data['company'])) {
    $body .= '<p><strong>Компания: </strong>' . htmlspecialchars($data['company']) . '</p>';
}

if(!empty($data['select']) && isset($email_addresses[$data['select']])) {
    $defaultMail = $email_addresses[$data['select']];
    $body .= '<p><strong>Цель запроса: </strong>' . htmlspecialchars($data['select']) . '</p>';
}

if(!empty($data['name'])) {
    $body .= '<p><strong>ФИО: </strong>' . htmlspecialchars($data['name']) . '</p>';
}

if(!empty($data['email'])) {
    $body .= '<p><strong>Email: </strong>' . htmlspecialchars($data['email']) . '</p>';
}

if(!empty($data['tel'])) {
    $body .= '<p><strong>Контактный телефон: </strong>' . htmlspecialchars($data['tel']) . '</p>';
}

if(!empty($data['message'])) {
    $body .= '<p><strong>Сообщение: </strong>' . htmlspecialchars($data['message']) . '</p>';
}

$mail->addAddress($defaultMail);
$mail->Body = $body;

try {
    $mail->send();
    $message = "Data sends";
} catch (Exception $e) {
    $message = "Error: " . $mail->ErrorInfo;
}

$response = ['message' => $message];
header('Content-type: application/json');
echo json_encode($response);
?>