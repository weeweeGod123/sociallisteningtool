import logging
import time
from combined_analyzer import CombinedAnalyzer
from db_connection import db_connection
from flask import Flask, request, jsonify
from flask_cors import CORS
from json_writer import AnalysisJSONWriter

# Configure logging
logging.basicConfig(level=logging.INFO, 
                   format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Initialise the text analyzer
text_analyzer = CombinedAnalyzer()

# Initialise JSON writer
json_writer = AnalysisJSONWriter()

# Initialise MongoDB connection
db = db_connection()

@app.route('/')
def home():
    return jsonify({"status": "running", "service": "sentiment-analysis"})

@app.route('/health')
def health_check():
    try:
        # Check if the model is loaded and ready
        if text_analyzer is not None:
            db_status = "connected" if db.start_db_connection() else "not connected"
            return jsonify({"status": "healthy", "model": "loaded", "db": db_status})
        return jsonify({"status": "unhealthy", "model": "not loaded"})
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return jsonify({"status": "unhealthy", "error": str(e)}), 500

@app.route('/analyse', methods=['POST'])
def analyse_text():
    try:
        data = request.get_json()
        if not data or 'text' not in data:
            return jsonify({"error": "No text provided"}), 400

        text = data['text']
        logger.info(f"Analyzing text: {text[:100]}...")

        # Perform analysis
        analysis_result = text_analyzer.analyze_text(text)
        
        # Save to JSON
        json_writer.save_analysis(text, analysis_result)
        
        return jsonify(
            {
            "success": True,
            "analysis": analysis_result,
            "post_id": data.get('post_id')
            }
        )
    except Exception as e:
        logger.error(f"Error analyzing text: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/analyse/batch', methods=['POST'])
def analyse_batch():
    try:
        data = request.get_json()
        batch_size = data.get('batch_size', 50) if data else 50
        source = data.get('source', None)  # Optional source filter (twitter, reddit, bluesky)
        
        # Fetch unanalysed posts
        unanalysed_posts = db.get_unanalysed_posts(batch_size, source)
        
        if not unanalysed_posts:
            return jsonify({
                "success": True,
                "processed": 0,
                "message": "No unanalysed posts found"
            })
        
        analysed_count = 0
        error_count = 0
        processed_ids = []  # Track which posts we've processed
        
        for post in unanalysed_posts:
            try:
                post_id = post.get('post_id')
                if not post_id:
                    logger.warning(f"Post {post.get('_id', 'unknown')} has no post_id.")
                    continue
                    
                post_source = post.get('platform')
                content = post.get('content_text', '')
                
                if not content:
                    logger.warning(f"Post {post_id} has no content to analyse.")
                    # Mark post as processed but with a warning
                    db.mark_post_analysis_skipped(post_id, "No content to analyse")
                    continue
                
                # Analyse the content
                result = text_analyzer.analyze_text(content)
                
                # Update post with sentiment analysis results
                status = db.update_post_sentiment(post_id, result, post_source)
                
                if status:
                    analysed_count += 1
                    processed_ids.append(post_id)
                else:
                    error_count += 1
                
                # Small delay to avoid overloading
                time.sleep(0.1)
                
            except Exception as e:
                error_count += 1
                logger.error(f"Error processing post {post.get('post_id', 'unknown')}: {str(e)}")
                
                # Mark the post as having failed analysis to prevent endless retries
                try:
                    db.mark_post_analysis_failed(post.get('post_id', 'unknown'), str(e))
                except Exception as mark_error:
                    logger.error(f"Error marking post as failed: {str(mark_error)}")
        
        # Get remaining counts
        remaining_counts = db.get_unanalysed_count()
        
        # Log which posts were processed
        if processed_ids:
            logger.info(f"Successfully processed {len(processed_ids)} posts: {processed_ids[:5]}{'...' if len(processed_ids) > 5 else ''}")
        
        return jsonify({
            "success": True,
            "processed": analysed_count,
            "errors": error_count,
            "remaining": remaining_counts,
            "message": f"Processed {analysed_count} posts, with {error_count} errors. {remaining_counts['total']} posts remaining."
        })
        
    except Exception as e:
        logger.error(f"Error in batch analysis: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/analyse-by-id', methods=['POST'])
def analyse_by_id():
    try:
        data = request.get_json()
        if not data or 'post_id' not in data:
            return jsonify({"error": "No post_id provided"}), 400
        
        post_id = data['post_id']
        source = data.get('source')  # Optional source parameter
        
        logger.info(f"Analyzing post with ID: {post_id}" + (f" from source: {source}" if source else ""))
        
        post, detected_source = db.find_post_by_id(post_id)
        if not post:
            return jsonify({"error": f"Post with ID {post_id} not found"}), 404

        content = post.get('content_text', '')
        if not content:
            return jsonify({
                "success": False,
                "message": "Post has no content to analyse"
            }), 400
        
        # Use provided source or detected source
        final_source = source or detected_source
        
        result = text_analyzer.analyze_text(content)
        status = db.update_post_sentiment(post_id, result, final_source)

        return jsonify({
            "success": status,
            "post_id": post_id,
            "source": final_source,
            "sentiment": result.get("sentiment")
        })
            
    except Exception as e:
        logger.error(f"Error in process endpoint: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

       
@app.route('/analyse/entities', methods=['POST'])
def extract_entities():
    try:
        data = request.get_json()
        if not data or 'text' not in data:
            return jsonify({"error": "No text provided"}), 400

        text = data['text']
        logger.info(f"Extracting entities from text: {text[:100]}...")

        # Extract entities
        entities_result = text_analyzer.extract_entities(text)
        
        return jsonify(entities_result)
    except Exception as e:
        logger.error(f"Error extracting entities: {str(e)}")
        return jsonify({"error": str(e)}), 500
    

@app.route('/unanalysed-count', methods=['GET'])
def get_unanalysed_count():
    try:
        # Get source filter from query parameter if provided
        source = request.args.get('source')
        counts = db.get_unanalysed_count()
        
        if source:
            source = source.lower()
            if source in counts:
                return jsonify({"total": counts.get(source, 0)})
            else:
                return jsonify({"error": f"Unknown source: {source}"}), 400
        
        return jsonify(counts)
    except Exception as e:
        logger.error(f"Error fetching unanalysed count: {str(e)}")
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    if not db.start_db_connection():
        logger.warning("Error When Connecting To MongoDB.")
    app.run(host='0.0.0.0', port=5004, debug=True)